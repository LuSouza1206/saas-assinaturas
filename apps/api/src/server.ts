import express, { Request, Response, NextFunction } from "express";
import passport from "passport";
import { ZodError } from "zod";
import { env } from "./config/env";
import { initSentry, captureException, setupSentryExpress } from "./config/sentry";
import { prisma } from "./lib/prisma";
import { getRedis, pingRedis } from "./config/redis";
import { applySecurity } from "./middleware/security";
import { apiRateLimiter } from "./middleware/rate-limit";
import { AppError, formatZodError } from "./lib/errors";
import { authRouter } from "./modules/auth/auth.controller";
import { tenantsRouter } from "./modules/tenants/tenants.controller";
import { plansRouter } from "./modules/plans/plans.controller";
import {
  subscriptionsRouter,
  dashboardRouter,
} from "./modules/subscriptions/subscriptions.controller";
import {
  billingRouter,
  stripeWebhookErrorHandler,
} from "./modules/billing/billing.controller";
import { usersRouter } from "./modules/users/users.controller";
import { startBillingWorker } from "./jobs/billing.worker";
import { startEmailWorker } from "./jobs/email.worker";
import { startBillingCron } from "./jobs/billing.cron";

initSentry();

const app = express();

app.use("/webhooks", billingRouter);
app.use(stripeWebhookErrorHandler);

applySecurity(app);
app.use(express.json({ limit: "1mb" }));
app.use(passport.initialize());
app.use(apiRateLimiter);

app.get(
  "/health",
  async (_req: Request, res: Response) => {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    const redisOk = await pingRedis();
    const status = dbOk && redisOk ? "ok" : "degraded";
    res.status(status === "ok" ? 200 : 503).json({
      status,
      db: dbOk ? "up" : "down",
      redis: redisOk ? "up" : "down",
      timestamp: new Date().toISOString(),
    });
  }
);

app.use("/auth", authRouter);
app.use("/tenants", tenantsRouter);
app.use("/plans", plansRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/users", usersRouter);

setupSentryExpress(app);

app.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: formatZodError(err),
      });
    }

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }

    captureException(err);
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
);

async function redisSupportsBullMQ(): Promise<boolean> {
  try {
    const client = getRedis();
    if (client.status !== "ready") {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          cleanup();
          resolve();
        };
        const onError = (err: Error) => {
          cleanup();
          reject(err);
        };
        const cleanup = () => {
          client.off("ready", onReady);
          client.off("error", onError);
        };
        client.once("ready", onReady);
        client.once("error", onError);
      });
    }

    const info = await client.info("server");
    const match = /redis_version:(\d+)\./.exec(info);
    const major = match ? Number(match[1]) : 0;
    console.log(`[api] Redis version major=${major}`);
    return major >= 5;
  } catch (err) {
    console.warn("[api] Redis version check failed", err);
    return false;
  }
}

async function bootstrap() {
  if (await redisSupportsBullMQ()) {
    startBillingWorker();
    startEmailWorker();
    startBillingCron();
  } else {
    console.warn(
      "[api] Redis < 5 detected — skipping BullMQ workers/cron (API still runs)"
    );
  }

  app.listen(env.port, () => {
    console.log(`[api] listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
