import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Reveal from "../../../reveal";
import { APP_VERSION } from "@/lib/core/version";

const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Foundry - Monad",
  description:
    "Foundry connectors pull CSV, REST, and live sources straight into ontology types — validated, freshness-badged, and audited. No download: it runs inside the ontology.",
};

const MONO = mono.style.fontFamily;

const STEPS = [
  {
    n: "01",
    t: "Connect",
    d: "15 typed connectors: CSV/XLSX uploads, paginated REST, webhook inbox, Postgres/SQLite bridges, registry, dockets, filings, press, TMS, fuel cards, broker email, ELD pings, manual forms.",
  },
  {
    n: "02",
    t: "Validate",
    d: "Every row is PII-scrubbed, quarantined on bad dates/numbers, deduped by key, and merged never-clobber into a conn_ ontology type.",
  },
  {
    n: "03",
    t: "Operate",
    d: "SyncRun ledger, per-connector freshness badges, tombstone deletes, rate-budget pauses, and resume-from-cursor — all audited on the event chain.",
  },
];

export default function FoundryPage() {
  return (
    <main className={`${sans.className} ds-text`}>
      <style>{`
        ::selection { background: var(--accent); color: #ffffff; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
        .rv { opacity: 0; transform: translateY(26px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
        .rv.in { opacity: 1; transform: none; }
        .cta-lift { transition: transform 0.2s cubic-bezier(0.16,1,0.3,1), background-color 0.2s; }
        .cta-lift:active { transform: translateY(1px) scale(0.98); }
        @media (prefers-reduced-motion: reduce) {
          .rv { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
      <noscript>
        <style>{`.rv { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>

      <section className="overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-center md:px-8 md:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[16ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Foundry
            </h1>
            <p className="mx-auto mt-6 max-w-[58ch] text-[17px] leading-relaxed ds-text-2">
              Data integration that lands straight in the ontology. Pull once,
              stay fresh, prove every row.
            </p>
            <div className="mt-8">
              <Link
                href="/sync"
                className="cta-lift inline-block whitespace-nowrap rounded-full px-7 py-3 text-[16px] font-bold text-white"
                style={{ background: "var(--accent)" }}
              >
                Use in Ontology
              </Link>
              <p className="mx-auto mt-3 max-w-[40ch] text-xs leading-relaxed ds-text-2">
                No download — Foundry runs inside the ontology (v{APP_VERSION}).
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="h-full rounded-2xl border ds-panel p-6 text-left">
                  <p className="text-xs ds-text-2" style={{ fontFamily: MONO }}>
                    {s.n}
                  </p>
                  <p className="mt-2 text-lg font-bold">{s.t}</p>
                  <p className="mt-2 text-[14px] leading-relaxed ds-text-2">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mx-auto mt-10 max-w-[58ch] text-center text-[16px] leading-relaxed ds-text-2">
              Every pull writes a SyncRun row. Latest 20 live at{" "}
              <Link href="/sync" className="underline">
                /sync
              </Link>{" "}
              with freshness per connector SLA.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
