"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, AuthSession } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [subdomain, setSubdomain] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "oauth") {
      setError("Falha no login com Google. Confira o workspace e tente de novo.");
    }
    api<{ google: boolean }>("/auth/providers")
      .then((p) => setGoogleEnabled(p.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const session = await api<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          subdomain: form.get("subdomain"),
        }),
      });
      setSession(session);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  function loginWithGoogle() {
    const sub = subdomain.trim().toLowerCase();
    if (!sub) {
      setError("Informe o workspace antes de continuar com Google.");
      return;
    }
    window.location.href = `${API_URL}/auth/oauth/google?subdomain=${encodeURIComponent(sub)}`;
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
            Entrar no workspace
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            Use o workspace da sua empresa para acessar.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="label-caps">Workspace</span>
              <input
                name="subdomain"
                required
                className="input-field"
                placeholder="sua-empresa"
                autoComplete="organization"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Email</span>
              <input
                name="email"
                type="email"
                required
                className="input-field"
                placeholder="voce@empresa.com"
                autoComplete="email"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="label-caps">Senha</span>
              <input
                name="password"
                type="password"
                required
                className="input-field"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          {googleEnabled && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs uppercase tracking-wider text-ink-faint">
                  ou
                </span>
                <div className="h-px flex-1 bg-line" />
              </div>
              <button
                type="button"
                onClick={loginWithGoogle}
                className="btn-ghost w-full"
              >
                Continuar com Google
              </button>
            </>
          )}

          <p className="mt-6 text-sm text-ink-faint">
            Não tem conta?{" "}
            <Link
              href="/register"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Criar workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
