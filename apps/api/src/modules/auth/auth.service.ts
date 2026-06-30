import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signToken } from "./guards/jwt.guard";
import { safeLog } from "../../middleware/security";

export const registerSchema = z.object({
  companyName: z.string().min(2).max(100),
  subdomain: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric/hyphens"),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  subdomain: z.string().min(2).max(40),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

function toPublicUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  };
}

export class AuthService {
  async register(input: RegisterInput) {
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain: input.subdomain },
    });
    if (existingTenant) {
      throw new AppError(409, "Subdomain already taken", "SUBDOMAIN_TAKEN");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName,
          subdomain: input.subdomain,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email.toLowerCase(),
          name: input.name,
          password: passwordHash,
          role: "ADMIN",
        },
      });

      return { tenant, user };
    });

    safeLog("[auth] tenant registered", {
      tenantId: result.tenant.id,
      subdomain: result.tenant.subdomain,
    });

    const token = signToken({
      sub: result.user.id,
      tenantId: result.tenant.id,
      email: result.user.email,
      role: result.user.role as "ADMIN" | "MEMBER",
    });

    return {
      token,
      user: toPublicUser(result.user),
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        subdomain: result.tenant.subdomain,
      },
    };
  }

  async login(input: LoginInput) {
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: input.subdomain },
    });
    if (!tenant) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: input.email.toLowerCase(),
        },
      },
    });

    if (!user?.password) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) {
      throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const token = signToken({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role as "ADMIN" | "MEMBER",
    });

    return {
      token,
      user: toPublicUser(user),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
    };
  }

  async me(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { tenant: true },
    });
    if (!user) {
      throw new AppError(404, "User not found");
    }
    return {
      user: toPublicUser(user),
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
      },
    };
  }
}

export const authService = new AuthService();
