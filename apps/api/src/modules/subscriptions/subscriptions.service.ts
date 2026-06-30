import { z } from "zod";
import { prisma, scopedPrisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { getStripe, isStripeConfigured } from "../../config/stripe";
import { env } from "../../config/env";

export const createSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export class SubscriptionsService {
  async list(tenantId: string) {
    const db = scopedPrisma(tenantId);
    return db.subscription.findMany({
      include: {
        plan: true,
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    tenantId: string,
    userId: string,
    input: CreateSubscriptionInput
  ) {
    const db = scopedPrisma(tenantId);
    const plan = await db.plan.findFirst({
      where: { id: input.planId, active: true },
    });
    if (!plan) throw new AppError(404, "Plan not found");

    const user = await db.user.findFirst({ where: { id: userId } });
    if (!user) throw new AppError(404, "User not found");

    const existing = await db.subscription.findFirst({
      where: {
        userId,
        status: { in: ["active", "past_due", "trialing", "incomplete"] },
      },
    });
    if (existing) {
      throw new AppError(409, "User already has an active subscription");
    }

    if (isStripeConfigured() && !plan.stripePriceId.startsWith("local_")) {
      const stripe = getStripe();

      let customerId: string;
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      if (customers.data[0]) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name ?? undefined,
          metadata: { tenantId, userId },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${env.frontendUrl}/subscriptions?checkout=success`,
        cancel_url: `${env.frontendUrl}/subscriptions?checkout=cancel`,
        metadata: { tenantId, userId, planId: plan.id },
        subscription_data: {
          metadata: { tenantId, userId, planId: plan.id },
        },
      });

      if (!session.url) {
        throw new AppError(500, "Stripe Checkout URL missing");
      }

      return { checkoutUrl: session.url, mode: "checkout" as const };
    }

    const periodEnd = new Date();
    periodEnd.setMonth(
      periodEnd.getMonth() + (plan.interval === "year" ? 12 : 1)
    );

    const subscription = await db.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: "active",
        stripeSubId: `local_sub_${Date.now()}`,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    return { subscription, mode: "local" as const };
  }

  async cancel(tenantId: string, subscriptionId: string) {
    const db = scopedPrisma(tenantId);
    const sub = await db.subscription.findFirst({
      where: { id: subscriptionId },
    });
    if (!sub) throw new AppError(404, "Subscription not found");

    if (isStripeConfigured() && !sub.stripeSubId.startsWith("local_")) {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(sub.stripeSubId);
    }

    const updated = await db.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });

    return updated;
  }

  async metrics(tenantId: string) {
    const active = await prisma.subscription.findMany({
      where: { tenantId, status: "active" },
      include: { plan: true },
    });

    const mrr = active.reduce((sum, s) => {
      const monthly =
        s.plan.interval === "year" ? Math.round(s.plan.price / 12) : s.plan.price;
      return sum + monthly;
    }, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledLast30 = await prisma.subscription.count({
      where: {
        tenantId,
        status: "canceled",
        canceledAt: { gte: thirtyDaysAgo },
      },
    });

    const activeAtStart =
      (await prisma.subscription.count({
        where: {
          tenantId,
          createdAt: { lte: thirtyDaysAgo },
          OR: [
            { status: "active" },
            { canceledAt: { gte: thirtyDaysAgo } },
          ],
        },
      })) || 1;

    const churnRate = Number(
      ((canceledLast30 / activeAtStart) * 100).toFixed(2)
    );

    return {
      mrr,
      mrrFormatted: (mrr / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      activeSubscribers: active.length,
      churnRate,
      canceledLast30Days: canceledLast30,
    };
  }
}

export const subscriptionsService = new SubscriptionsService();
