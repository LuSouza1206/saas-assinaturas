import * as Sentry from "@sentry/node";
import { env } from "./env";

export function initSentry() {
  if (!env.sentryDsn) {
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 1.0,
  });
}

export function captureException(
  error: unknown,
  context?: Record<string, string | number | undefined>
) {
  if (!env.sentryDsn) {
    console.error("[sentry-fallback]", error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        if (value !== undefined) {
          scope.setExtra(key, value);
        }
      });
    }
    Sentry.captureException(error);
  });
}

export function setupSentryExpress(app: import("express").Express) {
  if (!env.sentryDsn) return;
  Sentry.setupExpressErrorHandler(app);
}
