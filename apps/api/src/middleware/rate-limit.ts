import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const isDev = env.nodeEnv !== "production";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many auth attempts. Try again in 15 minutes.",
    code: "RATE_LIMITED",
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    code: "RATE_LIMITED",
  },
});
