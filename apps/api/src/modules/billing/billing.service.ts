import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { getStripe, isStripeConfigured } from "../../config/stripe";
import { AppError } from "../../lib/errors";
import { captureException } from "../../config/sentry";
import { enqueueEmail } from "../../jobs/email.queue";
import { safeLog } from "../../middleware/security";

function periodEndFromSubscription(stripeSub: Stripe.Subscription): Date {
  const item = stripeSub.items?.data?.[0] as
    | { current_period_end?: number }
    | undefined;
  const raw =
    (stripeSub as { current_period_end?: number }).current_period_end ??
    item?.current_period_end ??
    stripeSub.billing_cycle_anchor;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return new Date(raw * 1000);
  }

  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 1);
  return fallback;
}

function periodEndFromInvoice(invoice: Stripe.Invoice, fallback: Date): Date {
  const end = invoice.lines?.data?.[0]?.period?.end;
  if (typeof end === "number" && Number.isFinite(end) && end > 0) {
    return new Date(end * 1000);
  }
  return fallback;
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  const legacy = (invoice as { subscription?: string | { id: string } | null })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;

  const parent = (
    invoice as {
      parent?: {
        subscription_details?: { subscription?: string | { id: string } };
      };
    }
  ).parent?.subscription_details?.subscription;
  if (typeof parent === "string") return parent;
  if (parent && typeof parent === "object" && "id" in parent) return parent.id;

  const fromLine = (
    invoice.lines?.data?.[0] as
      | {
          parent?: {
            subscription_item_details?: { subscription?: string };
          };
          subscription?: string;
        }
      | undefined
  )?.parent?.subscription_item_details?.subscription;
  if (typeof fromLine === "string") return fromLine;

  return undefined;
}

export class BillingService {
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!isStripeConfigured()) {
      throw new AppError(503, "Stripe not configured");
    }
    const stripe = getStripe();
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.stripeWebhookSecret
    );
  }

  async handleWebhook(event: Stripe.Event) {
    safeLog("[stripe] webhook received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed":
        await this.onCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.onSubscriptionUpsert(
          event.data.object as Stripe.Subscription
        );
        break;
      case "invoice.payment_succeeded":
      case "invoice.paid":
        await this.onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.onInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await this.onSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        break;
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode !== "subscription") return;

    const stripeSubId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!stripeSubId) return;

    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    await this.upsertFromStripeSubscription(stripeSub, session.metadata ?? {});
  }

  private async onSubscriptionUpsert(stripeSub: Stripe.Subscription) {
    await this.upsertFromStripeSubscription(stripeSub, stripeSub.metadata ?? {});
  }

  private async upsertFromStripeSubscription(
    stripeSub: Stripe.Subscription,
    metadata: Stripe.Metadata
  ) {
    const tenantId = metadata.tenantId;
    const userId = metadata.userId;
    const planId = metadata.planId;
    if (!tenantId || !userId || !planId) {
      safeLog("[stripe] subscription missing metadata", { id: stripeSub.id });
      return;
    }

    const existing = await prisma.subscription.findUnique({
      where: { stripeSubId: stripeSub.id },
    });

    const status =
      stripeSub.status === "active" || stripeSub.status === "trialing"
        ? "active"
        : stripeSub.status;
    const currentPeriodEnd = periodEndFromSubscription(stripeSub);

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status, currentPeriodEnd },
      });
      return;
    }

    await prisma.subscription.create({
      data: {
        tenantId,
        userId,
        planId,
        status,
        stripeSubId: stripeSub.id,
        currentPeriodEnd,
      },
    });
  }

  private async onInvoicePaid(invoice: Stripe.Invoice) {
    const stripeSubId = subscriptionIdFromInvoice(invoice);
    if (!stripeSubId) {
      safeLog("[stripe] invoice without subscription id", { id: invoice.id });
      return;
    }

    let subscription = await prisma.subscription.findUnique({
      where: { stripeSubId },
      include: { user: true },
    });

    if (!subscription) {
      const stripe = getStripe();
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      await this.upsertFromStripeSubscription(
        stripeSub,
        stripeSub.metadata ?? {}
      );
      subscription = await prisma.subscription.findUnique({
        where: { stripeSubId },
        include: { user: true },
      });
    }
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "active",
        currentPeriodEnd: periodEndFromInvoice(
          invoice,
          subscription.currentPeriodEnd
        ),
      },
    });

    const already = await prisma.invoice.findFirst({
      where: { stripeInvoiceId: invoice.id },
    });
    if (!already) {
      await prisma.invoice.create({
        data: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          amount: invoice.amount_paid || invoice.amount_due || 0,
          status: "paid",
          stripeInvoiceId: invoice.id,
          paidAt: new Date(),
        },
      });
    }

    await enqueueEmail({
      to: subscription.user.email,
      type: "payment_success",
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: invoice.amount_paid || invoice.amount_due || 0,
    });
  }

  private async onInvoiceFailed(invoice: Stripe.Invoice) {
    const stripeSubId = subscriptionIdFromInvoice(invoice);
    if (!stripeSubId) return;

    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubId },
      include: { user: true },
    });
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "past_due" },
    });

    const already = await prisma.invoice.findFirst({
      where: { stripeInvoiceId: invoice.id },
    });
    if (!already) {
      await prisma.invoice.create({
        data: {
          tenantId: subscription.tenantId,
          subscriptionId: subscription.id,
          amount: invoice.amount_due,
          status: "failed",
          stripeInvoiceId: invoice.id,
        },
      });
    }

    captureException(new Error("Invoice payment failed"), {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
    });

    await enqueueEmail({
      to: subscription.user.email,
      type: "payment_failed",
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      amount: invoice.amount_due,
    });
  }

  private async onSubscriptionDeleted(stripeSub: Stripe.Subscription) {
    const subscription = await prisma.subscription.findUnique({
      where: { stripeSubId: stripeSub.id },
    });
    if (!subscription) return;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });
  }
}

export const billingService = new BillingService();
