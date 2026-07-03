"use client";

import { useEffect } from "react";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function SentryInit() {
  useEffect(() => {
    if (!dsn) return;

    let cancelled = false;

    (async () => {
      try {
        const Sentry = await import("@sentry/browser");
        if (cancelled) return;
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV,
          tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        });
      } catch {
          return;
        }    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
