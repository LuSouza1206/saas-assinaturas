import helmet from "helmet";
import cors from "cors";
import { Express, Request, Response, NextFunction } from "express";
import { env } from "../config/env";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "card",
  "cardNumber",
  "cvv",
  "cvc",
  "stripeSecretKey",
]);

export function applySecurity(app: Express) {
  app.use(helmet());

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(sanitizeInput);
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/[<>]/g, "")
      .replace(/javascript:/gi, "")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) {
        out[key] = val;
        continue;
      }
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}

export function safeLog(message: string, data?: Record<string, unknown>) {
  if (!data) {
    console.log(message);
    return;
  }
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    scrubbed[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : value;
  }
  console.log(message, scrubbed);
}
