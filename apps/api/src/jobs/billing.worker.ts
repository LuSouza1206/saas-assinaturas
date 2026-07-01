import { Worker, Job } from "bullmq";
import { prisma } from "../lib/prisma";
import { getRedis } from "../config/redis";
import { getStripe, isStripeConfigured } from "../config/stripe";
import { captureException } from "../config/sentry";
import { BILLING_QUEUE, BillingJobData } from "./billing.queue";
import { enqueueEmail } from "./email.queue";
import { safeLog } from "../middleware/security";

async function processBilling(job: Job<BillingJobData>) {
  const { subscriptionId, tenantId } = job.data;

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, tenantId },
    include: { user: true, plan: true },
  });

  if (!subscription) {
    throw new Error(`Subscription ${subscriptionId} not found for tenant`);
  }

  if (subscription.status === "canceled") {
    safeLog("[billing] skip canceled", { subscriptionId, tenantId });
    return;
  }

  try {
    if (isStripeConfigured() && !subscription.stripeSubId.startsWith("local_")) {
      const stripe = getStripe();
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripeSubId,
        limit: 1,
      });
      const latest = invoices.data[0];

      if (latest && latest.status !== "paid") {
        await stripe.invoices.pay(latest.id);
      }
    }

    const nextPeriod = new Date(subscription.currentPeriodEnd);
    nextPeriod.setMonth(
      nextPeriod.getMonth() + (subscription.plan.interval === "year" ? 12 : 1)
    );

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "active",
        currentPeriodEnd: nextPeriod,
      },
    });

    await prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount: subscription.plan.price,
        status: "paid",
        paidAt: new Date(),
      },
    });

    await enqueueEmail({
      to: subscription.user.email,
      type: "payment_success",
      tenantId,
      subscriptionId,
      amount: subscription.plan.price,
    });

    safeLog("[billing] charged", { subscriptionId, tenantId });
  } catch (err) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "past_due" },
    });

    await prisma.invoice.create({
      data: {
        tenantId,
        subscriptionId: subscription.id,
        amount: subscription.plan.price,
        status: "failed",
      },
    });

    captureException(err, { tenantId, subscriptionId });

    await enqueueEmail({
      to: subscription.user.email,
      type: "payment_failed",
      tenantId,
      subscriptionId,
      amount: subscription.plan.price,
    });

    throw err;
  }
}

export function startBillingWorker() {
  const worker = new Worker<BillingJobData>(BILLING_QUEUE, processBilling, {
    connection: getRedis(),
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    captureException(err, {
      jobId: job?.id,
      tenantId: job?.data.tenantId,
      subscriptionId: job?.data.subscriptionId,
      queue: BILLING_QUEUE,
    });
  });

  return worker;
}
