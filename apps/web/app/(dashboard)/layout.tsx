"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearSession,
  getSession,
  setSession,
  api,
  AuthSession,
} from "@/lib/api-client";

const nav = [
  { href: "/dashboard", label: "Métricas" },
  { href: "/plans", label: "Planos" },
  { href: "/subscriptions", label: "Assinaturas" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSessionState] = useState<AuthSession | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get("token");
    if (oauthToken) {
      localStorage.setItem("saas_token", oauthToken);
      api<{ user: AuthSession["user"]; tenant: AuthSession["tenant"] }>("/auth/me")
        .then((me) => {
          const next: AuthSession = {
            token: oauthToken,
            user: me.user,
            tenant: me.tenant,
          };
          setSession(next);
          setSessionState(next);
          window.history.replaceState({}, "", pathname);
        })
        .catch(() => router.replace("/login"));
      return;
    }

    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSessionState(s);
  }, [router, pathname]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-faint">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-paper-raised md:flex md:flex-col">
          <div className="border-b border-line px-5 py-5">
            <Link
              href="/dashboard"
              className="font-display text-xl italic tracking-brand text-ink"
            >
              Ledgerflow
            </Link>
            <p className="mt-1 truncate text-xs text-ink-faint">
              {session.tenant.name}
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-3">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-2 text-sm transition ${
                    active
                      ? "bg-paper-sunken font-medium text-ink"
                      : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-4">
            <p className="truncate text-xs text-ink-faint">{session.user.email}</p>
            <button
              onClick={logout}
              className="mt-2 text-xs text-ink-faint transition hover:text-ink"
            >
              Sair
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 md:hidden">
            <Link
              href="/dashboard"
              className="font-display text-lg italic tracking-brand"
            >
              Ledgerflow
            </Link>
            <button onClick={logout} className="text-xs text-ink-faint">
              Sair
            </button>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-line bg-paper-raised px-3 py-2 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-sm ${
                  pathname === item.href
                    ? "bg-paper-sunken font-medium text-ink"
                    : "text-ink-soft"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
