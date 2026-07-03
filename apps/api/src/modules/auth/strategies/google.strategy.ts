import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from "passport-google-oauth20";
import { Request } from "express";
import { env } from "../../../config/env";
import { prisma } from "../../../lib/prisma";

export type GoogleAuthUser = {
  id: string;
  tenantId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

export function isGoogleOAuthEnabled() {
  return Boolean(env.googleClientId && env.googleClientSecret);
}

export function configureGoogleStrategy() {
  if (!isGoogleOAuthEnabled()) {
    console.warn("[auth] Google OAuth not configured — skipping strategy");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
        passReqToCallback: true,
      },
      async (
        req: Request,
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) {
            return done(new Error("Google account has no email"));
          }

          const subdomain =
            typeof req.query.state === "string" ? req.query.state : undefined;

          const tenant = subdomain
            ? await prisma.tenant.findUnique({ where: { subdomain } })
            : null;

          if (!tenant) {
            return done(
              new Error(
                "Workspace not found. Register the company first, then sign in with Google."
              )
            );
          }

          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { googleId: profile.id, tenantId: tenant.id },
                { tenantId: tenant.id, email },
              ],
            },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                tenantId: tenant.id,
                email,
                name: profile.displayName,
                googleId: profile.id,
                role: "MEMBER",
              },
            });
          } else if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id, name: user.name ?? profile.displayName },
            });
          }

          const authUser: GoogleAuthUser = {
            id: user.id,
            tenantId: user.tenantId,
            email: user.email,
            role: user.role as "ADMIN" | "MEMBER",
          };

          return done(null, authUser as unknown as Express.User);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}
