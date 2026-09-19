import type { Metadata } from "next";
import Link from "next/link";
import { Outfit, JetBrains_Mono } from "next/font/google";

const sans = Outfit({ subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap" });

// Dials: VARIANCE 4 / MOTION 3 / DENSITY 4 for trust-first lending.
// Shape rule: all-soft. Cards rounded-2xl, buttons and inputs rounded-xl.
// Color lock: stone neutrals plus single accent emerald-700. No other accent.

export const metadata: Metadata = {
  title: "Lender Eye - Fund the alive",
  description: "Public data risk check for small lenders in 40 seconds.",
};

function Mark({ letter }: { letter: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" role="img" aria-label={`${letter} logo`}>
      <circle cx="14" cy="14" r="13" fill="#e7e5e4" stroke="#d6d3d1" />
      <text x="14" y="19" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1c1917" fontFamily="sans-serif">
        {letter}
      </text>
    </svg>
  );
}

export default function LenderEyePage() {
  return (
    <main className={`${sans.className} bg-[#e8e6e1] text-stone-900 dark:bg-zinc-950 dark:text-zinc-100`}>
      <style>{`
        .neu { background: #e8e6e1; box-shadow: 8px 8px 20px #c9c6bf, -8px -8px 20px #ffffff; }
        .neu-in { background: #e8e6e1; box-shadow: inset 6px 6px 14px #c9c6bf, inset -6px -6px 14px #ffffff; }
        .neu-btn { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s; }
        .neu-btn:active { transform: translateY(1px) scale(0.98); }
        @media (prefers-color-scheme: dark) {
          .neu, .neu-in { background: #18181b; box-shadow: 8px 8px 20px #0a0a0b, -8px -8px 20px #27272a; }
        }
      `}</style>

      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/lender-eye" className="flex items-center gap-2 font-bold">
          <Mark letter="L" />
          <span>Lender Eye</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link href="#how" className="hover:underline">How it works</Link>
          <Link href="#proof" className="hover:underline">Proof</Link>
          <Link href="#sources" className="hover:underline">Sources</Link>
        </nav>
        <Link href="#cta" className="neu-btn neu rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-none" style={{ background: "#047857" }}>
          Run free check
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 pt-16 min-h-[100dvh] md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">Public data risk check</p>
          <h1 className="mt-3 text-4xl font-bold leading-none tracking-tighter md:text-5xl">Fund the alive. Skip the dead.</h1>
          <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-stone-600">Type a company. See liens, suits and shutdown signals in 40 seconds with sources.</p>
          <div className="mt-6 flex gap-3">
            <Link href="#cta" className="neu-btn rounded-xl px-5 py-2 font-semibold text-white" style={{ background: "#047857" }}>
              Run free check
            </Link>
            <Link href="#proof" className="neu-btn neu rounded-xl px-5 py-2 font-semibold text-stone-900">
              See proof
            </Link>
          </div>
        </div>
        <div className="w-full">
          <img
            src="https://picsum.photos/seed/lender-storefront/1200/900"
            width={1200}
            height={900}
            alt="Small business storefront on a quiet street"
            className="neu w-full rounded-2xl object-cover"
            loading="eager"
          />
          <p className="mt-2 text-sm text-stone-600">Sample street. Real check uses registry and court data.</p>
        </div>
      </section>

      <section aria-label="Customers" className="mx-auto max-w-7xl px-4 py-8">
        <div className="neu flex items-center justify-between gap-6 overflow-x-auto rounded-2xl px-6 py-4">
          <Mark letter="A" />
          <Mark letter="B" />
          <Mark letter="C" />
          <Mark letter="D" />
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="max-w-xl text-3xl font-bold tracking-tighter">One input. Three answers.</h2>
        <p className="mt-2 max-w-[65ch] text-stone-600">We read what lenders miss in public records and web signals.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="neu overflow-hidden rounded-2xl">
            <img src="https://picsum.photos/seed/lender-docs/800/500" width={800} height={500} alt="Court and registry documents" className="h-40 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h3 className="font-semibold">Type the name</h3>
              <p className="mt-1 text-sm text-stone-600">Domain plus state. No login. No core hookup.</p>
            </div>
          </div>
          <div className="rounded-2xl p-5 text-white" style={{ background: "#047857" }}>
            <h3 className="font-semibold">See the flags</h3>
            <p className="mt-1 text-sm opacity-90">Liens, suits, address flips and review collapse with links.</p>
            <p className={`mt-4 text-2xl font-bold ${mono.className}`}>40s</p>
          </div>
          <div className="neu rounded-2xl p-5">
            <h3 className="font-semibold">Decide fast</h3>
            <p className="mt-1 text-sm text-stone-600">Fund, review or kill. Every call cites the source row.</p>
          </div>
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-7xl px-4 py-16">
        <div className="neu grid gap-8 rounded-2xl p-6 md:grid-cols-2 md:p-10">
          <div>
            <h2 className="text-3xl font-bold tracking-tighter">It flagged them early.</h2>
            <p className="mt-3 max-w-[65ch] text-stone-600">Replay on five public failures from last year. Four showed kill signals 60 days before close.</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="neu-in rounded-2xl p-4">
                <p className={`${mono.className} text-3xl font-bold`}>4/5</p>
                <p className="text-sm text-stone-600">flagged early in replay</p>
              </div>
              <div className="neu-in rounded-2xl p-4">
                <p className={`${mono.className} text-3xl font-bold`}>62d</p>
                <p className="text-sm text-stone-600">median lead time</p>
              </div>
            </div>
            <blockquote className="mt-6 text-lg leading-snug">
              <p>“We stopped two bad advances in week one.”</p>
              <footer className="mt-2 text-sm text-stone-600">Maya R - Ops lead, Brightline Capital</footer>
            </blockquote>
          </div>
          <div className="w-full">
            <img src="https://picsum.photos/seed/lender-team/1000/800" width={1000} height={800} alt="Small lending team reviewing files" className="w-full rounded-2xl object-cover" loading="lazy" />
            <div className="neu-in mt-4 rounded-2xl p-4 text-sm">
              <p className="font-semibold">Sample result</p>
              <p className="mt-1 text-stone-600">Acme Repair LLC - KILL. 2 suits, dissolved registry, reviews down 68 percent. Sources linked.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="sources" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-bold tracking-tighter">Built on open records.</h2>
        <p className="mt-2 max-w-[65ch] text-stone-600">Only public sources. No private bank data. No scraping behind logins.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-300 p-5">
            <h3 className="font-semibold">Records</h3>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              <span className="neu rounded-xl px-3 py-1 text-sm">Registry</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">Courts</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">Liens</span>
            </div>
          </div>
          <div className="rounded-2xl border border-stone-300 p-5">
            <h3 className="font-semibold">Web</h3>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              <span className="neu rounded-xl px-3 py-1 text-sm">Reviews</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">Hiring</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">News</span>
            </div>
          </div>
          <div className="rounded-2xl border border-stone-300 p-5">
            <h3 className="font-semibold">Money trail</h3>
            <div className="mt-3 flex gap-2 overflow-x-auto">
              <span className="neu rounded-xl px-3 py-1 text-sm">Filings</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">Shipping</span>
              <span className="neu rounded-xl px-3 py-1 text-sm">Domains</span>
            </div>
          </div>
        </div>
      </section>

      <section id="cta" className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="mx-auto max-w-xl text-4xl font-bold tracking-tighter">Run your riskiest borrower.</h2>
        <p className="mx-auto mt-3 max-w-[65ch] text-stone-600">Free check. Sources included. Keep the report either way.</p>
        <form className="neu mx-auto mt-8 flex max-w-md gap-2 rounded-2xl p-2" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="company" className="sr-only">Company name</label>
          <input id="company" name="company" type="text" placeholder="Company name" className="neu-in w-full rounded-xl px-4 py-2 text-stone-900 placeholder:text-stone-500" />
          <button type="submit" className="neu-btn shrink-0 rounded-xl px-5 py-2 font-semibold text-white" style={{ background: "#047857" }}>
            Run free check
          </button>
        </form>
        <p className="mt-3 text-sm text-stone-600">Informational signal only. You decide. Ask counsel on credit rules.</p>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap justify-center gap-6 px-4 py-8 text-sm text-stone-600">
        <Link href="#how" className="underline">How it works</Link>
        <Link href="#proof" className="underline">Proof</Link>
        <Link href="#sources" className="underline">Sources</Link>
      </footer>
    </main>
  );
}
