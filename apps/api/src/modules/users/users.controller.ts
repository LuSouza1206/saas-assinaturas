import { Router } from "express";
import { asyncHandler } from "../../lib/errors";
import { jwtGuard, requireRole } from "../auth/guards/jwt.guard";
import { tenantResolver } from "../../middleware/tenant-resolver";
import { scopedPrisma } from "../../lib/prisma";

export const usersRouter = Router();

usersRouter.use(jwtGuard, tenantResolver);

usersRouter.get(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const db = scopedPrisma(req.tenantId!);
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  })
);
