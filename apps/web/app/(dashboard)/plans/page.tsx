"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  active: boolean;
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = getSession()?.user.role === "ADMIN";

  async function load() {
    try {
      const data = await api<Plan[]>("/plans");
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const priceReais = Number(form.get("price"));
    try {
      await api("/plans", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || undefined,
          price: Math.round(priceReais * 100),
          interval: form.get("interval"),
        }),
      });
      formEl.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar plano");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl animate-rise">
      <h1 className="font-display text-3xl italic tracking-brand text-ink sm:text-4xl">
        Planos
      </h1>
      <p className="mt-2 text-sm text-ink-faint">
        Preços em centavos no banco; exibidos em BRL.
      </p>

      {error && (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isAdmin && (
        <form
          onSubmit={onCreate}
          className="mt-8 grid gap-3 border-b border-line pb-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          <input
            name="name"
            required
            placeholder="Nome do plano"
            className="input-field"
          />
          <input
            name="price"
            type="number"
            step="0.01"
            min="1"
            required
            placeholder="Preço (R$)"
            className="input-field"
          />
          <select name="interval" className="input-field" defaultValue="month">
            <option value="month">Mensal</option>
            <option value="year">Anual</option>
          </select>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Criando…" : "Criar plano"}
          </button>
          <input
            name="description"
            placeholder="Descrição (opcional)"
            className="input-field sm:col-span-2 lg:col-span-4"
          />
        </form>
      )}

      <ul className="mt-2 divide-y divide-line">
        {plans.length === 0 && (
          <li className="py-8 text-sm text-ink-faint">Nenhum plano ainda.</li>
        )}
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex flex-wrap items-baseline justify-between gap-2 py-5"
          >
            <div>
              <p className="font-medium text-ink">{plan.name}</p>
              {plan.description && (
                <p className="mt-0.5 text-sm text-ink-faint">{plan.description}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-display text-2xl italic tracking-brand text-ink">
                {formatPrice(plan.price)}
              </p>
              <p className="text-xs text-ink-faint">
                /{plan.interval === "year" ? "ano" : "mês"}
                {!plan.active && " · inativo"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
