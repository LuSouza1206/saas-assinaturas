import { z } from "zod";
import { scopedPrisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { getStripe, isStripeConfigured } from "../../config/stripe";

export const createPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().int().positive(),
  interval: z.enum(["month", "year"]),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export class PlansService {
  async list(tenantId: string) {
    const db = scopedPrisma(tenantId);
    return db.plan.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    });
  }

  async listAll(tenantId: string) {
    const db = scopedPrisma(tenantId);
    return db.plan.findMany({ orderBy: { createdAt: "desc" } });
  }

  async create(tenantId: string, input: CreatePlanInput) {
    const db = scopedPrisma(tenantId);
    let stripePriceId = `local_price_${Date.now()}`;
    let stripeProductId: string | undefined;

    if (isStripeConfigured()) {
      const stripe = getStripe();
      const product = await stripe.products.create({
        name: input.name,
        description: input.description,
        metadata: { tenantId },
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: input.price,
        currency: "brl",
        recurring: { interval: input.interval },
        metadata: { tenantId },
      });
      stripePriceId = price.id;
      stripeProductId = product.id;
    }

    return db.plan.create({
      data: {
        name: input.name,
        description: input.description,
        price: input.price,
        interval: input.interval,
        stripePriceId,
        stripeProductId,
      },
    });
  }

  async update(tenantId: string, planId: string, input: UpdatePlanInput) {
    const db = scopedPrisma(tenantId);
    const updated = await db.plan.update({
      where: { id: planId },
      data: input,
    });
    if (!updated) throw new AppError(404, "Plan not found");
    return updated;
  }

  async getById(tenantId: string, planId: string) {
    const db = scopedPrisma(tenantId);
    const plan = await db.plan.findFirst({ where: { id: planId } });
    if (!plan) throw new AppError(404, "Plan not found");
    return plan;
  }
}

export const plansService = new PlansService();
