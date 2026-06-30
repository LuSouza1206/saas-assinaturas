import { Router } from "express";
import { asyncHandler, validateBody } from "../../lib/errors";
import { jwtGuard, requireRole } from "../auth/guards/jwt.guard";
import { tenantResolver } from "../../middleware/tenant-resolver";
import {
  createPlanSchema,
  plansService,
  updatePlanSchema,
} from "./plans.service";

export const plansRouter = Router();

plansRouter.use(jwtGuard, tenantResolver);

plansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const plans = await plansService.listAll(req.tenantId!);
    res.json(plans);
  })
);

plansRouter.post(
  "/",
  requireRole("ADMIN"),
  validateBody(createPlanSchema),
  asyncHandler(async (req, res) => {
    const plan = await plansService.create(req.tenantId!, req.body);
    res.status(201).json(plan);
  })
);

plansRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  validateBody(updatePlanSchema),
  asyncHandler(async (req, res) => {
    const plan = await plansService.update(
      req.tenantId!,
      String(req.params.id),
      req.body
    );
    res.json(plan);
  })
);
