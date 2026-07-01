import { Queue } from "bullmq";
import { getRedis } from "../config/redis";

export const BILLING_QUEUE = "billing";

export type BillingJobData = {
  subscriptionId: string;
  tenantId: string;
};

let billingQueue: Queue<BillingJobData> | null = null;

export function getBillingQueue() {
  if (!billingQueue) {
    billingQueue = new Queue<BillingJobData>(BILLING_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }
  return billingQueue;
}

export async function enqueueBilling(data: BillingJobData) {
  await getBillingQueue().add("charge", data, {
    jobId: `charge-${data.subscriptionId}-${Date.now()}`,
  });
}
