import { Worker, Job } from "bullmq";
import { getRedis } from "../config/redis";
import { captureException } from "../config/sentry";
import { env } from "../config/env";
import { EMAIL_QUEUE, EmailJobData } from "./email.queue";
import { safeLog } from "../middleware/security";

function formatAmount(cents?: number) {
  if (cents === undefined) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  text: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.EMAIL_FROM ?? "Ledgerflow <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend failed: ${res.status} ${body}`);
  }
  return true;
}

async function processEmail(job: Job<EmailJobData>) {
  const { to, type, tenantId, subscriptionId, amount } = job.data;

  const subjects: Record<EmailJobData["type"], string> = {
    payment_success: "Pagamento confirmado",
    payment_failed: "Falha no pagamento da assinatura",
    subscription_canceled: "Assinatura cancelada",
  };

  const subject = subjects[type];
  const text = [
    subject,
    "",
    `Valor: ${formatAmount(amount) || "—"}`,
    `Assinatura: ${subscriptionId}`,
    `Tenant: ${tenantId}`,
    "",
    `Ambiente: ${env.nodeEnv}`,
  ].join("\n");

  const sent = await sendViaResend({ to, subject, text });
  if (!sent) {
    safeLog("[email] console fallback", {
      to,
      type,
      subject,
      amount: formatAmount(amount),
      tenantId,
      subscriptionId,
    });
  } else {
    safeLog("[email] sent via Resend", { to, type, tenantId, subscriptionId });
  }
}

export function startEmailWorker() {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmail, {
    connection: getRedis(),
  });

  worker.on("failed", (job, err) => {
    captureException(err, {
      jobId: job?.id,
      tenantId: job?.data.tenantId,
      subscriptionId: job?.data.subscriptionId,
      queue: EMAIL_QUEUE,
    });
  });

  return worker;
}
