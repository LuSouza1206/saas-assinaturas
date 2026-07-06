"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, AuthSession } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const session = await api<AuthSession>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          companyName: form.get("companyName"),
          subdomain: form.get("subdomain"),
          email: form.get("email"),
          password: form.get("password"),
          name: form.get("name") || undefined,
        }),
      });
      setSession(session);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="relative hidden ledger-atmosphere md:flex md:flex-col md:justify-between md:p-10">
        <Link
          href="/"
          className="font-display text-3xl italic tracking-brand text-white"
        >
          Ledgerflow
        </Link>
      </aside>

      <main className="flex flex-col justify-center bg-paper-raised px-6 py-16 md:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="mb-10 inline-block font-display text-2xl italic tracking-brand text-ink md:hidden"
          >
            Ledgerflow
          </Link>
          <h1 className="font-display text-3xl italic tracking-brand text-ink">
            Criar workspace
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            Você será o admin do tenant.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="label-caps">Empresa</span>
              <input
                name="companyName"
                required
                className="input-field"
                placeholder="Sua empresa"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Workspace</span>
              <div className="flex items-center gap-2">
                <input
                  name="subdomain"
                  required
                  pattern="[a-z0-9-]+"
                  title="Só letras minúsculas, números e hífen"
                  className="input-field"
                  placeholder="sua-empresa"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    const next = el.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    if (el.value !== next) el.value = next;
                  }}
                />
                <span className="shrink-0 text-sm text-ink-faint">
                  .ledgerflow.app
                </span>
              </div>
              <span className="block text-xs text-ink-faint">
                Só letras minúsculas, números e hífen.
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Seu nome</span>
              <input name="name" className="input-field" placeholder="Seu nome" />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Email</span>
              <input
                name="email"
                type="email"
                required
                className="input-field"
                placeholder="seu@email.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Senha</span>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="input-field"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Criando…" : "Criar conta"}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-faint">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
