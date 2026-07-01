import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { enqueueBilling } from "./billing.queue";
import { safeLog } from "../middleware/security";

export function startBillingCron() {
  cron.schedule("0 2 * * *", async () => {
    safeLog("[cron] billing sweep started");
    try {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const due = await prisma.subscription.findMany({
        where: {
          status: { in: ["active", "past_due"] },
          currentPeriodEnd: { lte: endOfDay },
        },
        select: { id: true, tenantId: true },
      });

      for (const sub of due) {
        await enqueueBilling({
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
        });
      }

      safeLog("[cron] billing sweep enqueued", { count: due.length });
    } catch (err) {
      console.error("[cron] billing sweep failed", err);
    }
  });
}
