"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";

type Plan = {
  id: string;
  name: string;
  price: number;
  interval: string;
  active: boolean;
};

type Subscription = {
  id: string;
  status: string;
  currentPeriodEnd: string;
  plan: Plan;
  user: { id: string; email: string; name: string | null };
};

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const [s, p] = await Promise.all([
        api<Subscription[]>("/subscriptions"),
        api<Plan[]>("/plans"),
      ]);
      setSubs(s);
      setPlans(p.filter((x) => x.active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    load();
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout === "success") {
      setInfo("Pagamento recebido. A assinatura deve aparecer em instantes.");
      setTimeout(() => load(), 1500);
    } else if (checkout === "cancel") {
      setInfo("Checkout cancelado. Nenhuma cobrança foi feita.");
    }
  }, []);

  async function onSubscribe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<{
        mode: "checkout" | "local";
        checkoutUrl?: string;
      }>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ planId: form.get("planId") }),
      });

      if (result.mode === "checkout" && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      await load();
      setInfo("Assinatura local criada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao assinar");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    setError("");
    try {
      await api(`/subscriptions/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar");
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-rise">
      <h1 className="font-display text-3xl italic tracking-brand text-ink sm:text-4xl">
        Assinaturas
      </h1>
      <p className="mt-2 text-sm text-ink-faint">
        Com Stripe ativo, você vai para o Checkout (cartão de teste 4242…).
      </p>

      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="mt-4 text-sm text-accent-signal" role="status">
          {info}
        </p>
      )}

      <form
        onSubmit={onSubscribe}
        className="mt-8 flex flex-wrap items-end gap-3 border-b border-line pb-8"
      >
        <label className="min-w-[200px] flex-1 space-y-1.5">
          <span className="label-caps">Plano</span>
          <select name="planId" required className="input-field" defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatPrice(p.price)}/{p.interval}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Redirecionando…" : "Assinar com Stripe"}
        </button>
      </form>

      <ul className="mt-2 divide-y divide-line">
        {subs.length === 0 && (
          <li className="py-8 text-sm text-ink-faint">
            Nenhuma assinatura neste tenant.
          </li>
        )}
        {subs.map((sub) => (
          <li
            key={sub.id}
            className="flex flex-wrap items-center justify-between gap-4 py-5"
          >
            <div>
              <p className="font-medium text-ink">{sub.plan.name}</p>
              <p className="mt-0.5 text-sm text-ink-faint">
                {sub.user.email} ·{" "}
                <span
                  className={
                    sub.status === "active"
                      ? "text-accent-signal"
                      : sub.status === "past_due"
                        ? "text-warn"
                        : "text-ink-faint"
                  }
                >
                  {sub.status}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Período até{" "}
                {new Date(sub.currentPeriodEnd).toLocaleDateString("pt-BR")}
              </p>
            </div>
            {sub.status !== "canceled" && (
              <button onClick={() => cancel(sub.id)} className="btn-danger">
                Cancelar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
