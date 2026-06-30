import { Router } from "express";
import { z } from "zod";
import { asyncHandler, validateBody } from "../../lib/errors";
import { jwtGuard, requireRole } from "../auth/guards/jwt.guard";
import { tenantResolver } from "../../middleware/tenant-resolver";
import { tenantsService } from "./tenants.service";

export const tenantsRouter = Router();

tenantsRouter.use(jwtGuard, tenantResolver);

tenantsRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const tenant = await tenantsService.getById(req.tenantId!);
    res.json(tenant);
  })
);

tenantsRouter.patch(
  "/me",
  requireRole("ADMIN"),
  validateBody(z.object({ name: z.string().min(2).max(100) })),
  asyncHandler(async (req, res) => {
    const tenant = await tenantsService.updateName(req.tenantId!, req.body.name);
    res.json(tenant);
  })
);
