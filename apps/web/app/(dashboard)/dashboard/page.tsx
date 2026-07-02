"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

type Metrics = {
  mrr: number;
  mrrFormatted: string;
  activeSubscribers: number;
  churnRate: number;
  canceledLast30Days: number;
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Metrics>("/dashboard/metrics")
      .then(setMetrics)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl animate-rise">
      <h1 className="font-display text-3xl italic tracking-brand text-ink sm:text-4xl">
        Métricas
      </h1>
      <p className="mt-2 text-sm text-ink-faint">
        MRR, churn e assinantes ativos do seu tenant.
      </p>

      {error && (
        <p className="mt-6 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {!metrics && !error && (
        <p className="mt-10 text-sm text-ink-faint">Carregando métricas…</p>
      )}

      {metrics && (
        <div className="mt-10 grid border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
          <Metric
            label="MRR"
            value={metrics.mrrFormatted}
            hint="Receita recorrente mensal"
          />
          <Metric
            label="Assinantes ativos"
            value={String(metrics.activeSubscribers)}
            hint="Status active"
          />
          <Metric
            label="Churn (30d)"
            value={`${metrics.churnRate}%`}
            hint={`${metrics.canceledLast30Days} cancelamentos`}
          />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="py-8 sm:px-6 first:sm:pl-0 last:sm:pr-0">
      <p className="label-caps">{label}</p>
      <p className="mt-3 font-display text-4xl italic tracking-brand text-ink">
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}
