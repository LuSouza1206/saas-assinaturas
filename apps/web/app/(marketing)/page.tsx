import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden ledger-atmosphere text-ink-inverse">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 animate-fade">
        <Link
          href="/"
          className="font-display text-2xl italic tracking-brand text-white"
        >
          Ledgerflow
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded border border-white/25 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded border border-white bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-paper"
          >
            Começar
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] w-full max-w-6xl flex-col justify-end px-6 pb-16 pt-10 sm:justify-center sm:pb-24">
        <p className="font-display text-5xl italic leading-[1.02] tracking-brand text-white sm:text-7xl md:text-8xl animate-rise">
          Ledgerflow
        </p>
        <h1 className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg animate-rise-delay">
          Cobrança recorrente multi-tenant para SaaS B2B — planos, assinaturas e
          MRR em um só lugar.
        </h1>
        <div className="mt-9 flex flex-wrap gap-3 animate-rise-delay-2">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded border border-white bg-white px-5 py-3 text-sm font-medium text-ink transition hover:bg-paper"
          >
            Criar workspace
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded border border-white/25 bg-transparent px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Já tenho conta
          </Link>
        </div>
      </main>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[38vh] sm:h-[42vh]"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#061526] via-[#061526]/70 to-transparent" />
        <svg
          className="absolute bottom-8 left-1/2 h-28 w-[min(920px,92vw)] -translate-x-1/2 animate-drift sm:bottom-12 sm:h-36"
          viewBox="0 0 920 120"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 90 C80 90 100 40 180 42 C260 44 280 78 360 70 C440 62 460 28 540 30 C620 32 660 68 740 58 C800 50 860 36 920 24"
            stroke="rgba(45,212,191,0.75)"
            strokeWidth="2.5"
            className="animate-draw"
            strokeDasharray="200"
          />
          <path
            d="M0 90 C80 90 100 40 180 42 C260 44 280 78 360 70 C440 62 460 28 540 30 C620 32 660 68 740 58 C800 50 860 36 920 24 V120 H0 Z"
            fill="url(#heroFill)"
            opacity="0.4"
          />
          <defs>
            <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#2dd4bf" stopOpacity="0.55" />
              <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
