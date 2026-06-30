import { Router, Request, Response } from "express";
import passport from "passport";
import { asyncHandler, validateBody } from "../../lib/errors";
import { authRateLimiter } from "../../middleware/rate-limit";
import { env } from "../../config/env";
import {
  authService,
  loginSchema,
  registerSchema,
} from "./auth.service";
import { jwtGuard, signToken } from "./guards/jwt.guard";
import {
  configureGoogleStrategy,
  GoogleAuthUser,
  isGoogleOAuthEnabled,
} from "./strategies/google.strategy";

configureGoogleStrategy();

export const authRouter = Router();

authRouter.get("/providers", (_req, res) => {
  res.json({
    google: isGoogleOAuthEnabled(),
  });
});

authRouter.post(
  "/register",
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  })
);

authRouter.post(
  "/login",
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  })
);

authRouter.get(
  "/me",
  jwtGuard,
  asyncHandler(async (req, res) => {
    const result = await authService.me(req.user!.sub, req.user!.tenantId);
    res.json(result);
  })
);

authRouter.get("/oauth/google", (req: Request, res: Response, next) => {
  if (!isGoogleOAuthEnabled()) {
    return res.status(503).json({ error: "Google OAuth not configured" });
  }

  const subdomain = String(req.query.subdomain ?? "")
    .trim()
    .toLowerCase();
  if (!subdomain) {
    return res.status(400).json({
      error: "Query param subdomain is required",
      code: "SUBDOMAIN_REQUIRED",
    });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: subdomain,
  })(req, res, next);
});

authRouter.get(
  "/oauth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${env.frontendUrl}/login?error=oauth`,
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as unknown as GoogleAuthUser;
    const token = signToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
    res.redirect(`${env.frontendUrl}/dashboard?token=${encodeURIComponent(token)}`);
  }
);
