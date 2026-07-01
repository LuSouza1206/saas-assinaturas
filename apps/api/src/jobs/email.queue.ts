import { Queue } from "bullmq";
import { getRedis } from "../config/redis";

export const EMAIL_QUEUE = "email";

export type EmailJobData = {
  to: string;
  type: "payment_success" | "payment_failed" | "subscription_canceled";
  tenantId: string;
  subscriptionId: string;
  amount?: number;
};

let emailQueue: Queue<EmailJobData> | null = null;

export function getEmailQueue() {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    });
  }
  return emailQueue;
}

export async function enqueueEmail(data: EmailJobData) {
  await getEmailQueue().add(data.type, data);
}
