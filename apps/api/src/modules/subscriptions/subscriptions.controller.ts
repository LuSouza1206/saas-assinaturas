import { Router } from "express";
import { asyncHandler, validateBody } from "../../lib/errors";
import { jwtGuard, requireRole } from "../auth/guards/jwt.guard";
import { tenantResolver } from "../../middleware/tenant-resolver";
import {
  createSubscriptionSchema,
  subscriptionsService,
} from "./subscriptions.service";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(jwtGuard, tenantResolver);

subscriptionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const subs = await subscriptionsService.list(req.tenantId!);
    res.json(subs);
  })
);

subscriptionsRouter.post(
  "/",
  validateBody(createSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const sub = await subscriptionsService.create(
      req.tenantId!,
      req.user!.sub,
      req.body
    );
    res.status(201).json(sub);
  })
);

subscriptionsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const sub = await subscriptionsService.cancel(
      req.tenantId!,
      String(req.params.id)
    );
    res.json(sub);
  })
);

export const dashboardRouter = Router();

dashboardRouter.use(jwtGuard, tenantResolver);

dashboardRouter.get(
  "/metrics",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const metrics = await subscriptionsService.metrics(req.tenantId!);
    res.json(metrics);
  })
);
