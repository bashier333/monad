import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { checkCourtListener } from "@/lib/core/livedata/courtlistener";
import { checkEdgar } from "@/lib/core/livedata/edgar";
import { checkGdelt } from "@/lib/core/livedata/gdelt";
import { checkOpenCorporates } from "@/lib/core/livedata/opencorporates";
import { recentChecks } from "@/lib/core/livedata/cache";

const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "Model dashboard - Monad",
  description: "Live source status and recent checks for the borrower-risk ontology.",
};

export const dynamic = "force-dynamic";

const TYPES = [
  { t: "Company", d: "The borrower. Name, status, registry standing." },
  { t: "RegistryRecord", d: "Dissolution dates, addresses, standing." },
  { t: "CourtDocket", d: "Case names, filing dates, counts." },
  { t: "Filing", d: "10-K and 10-Q presence, distress language." },
  { t: "PressMention", d: "Tone, volume, links over 90 days." },
];

async function probe() {
  const company = "Acme";
  const opts = { timeoutMs: 3500, retries: 0 };
  const [oc, cl, ed, gd] = await Promise.all([
    checkOpenCorporates(company, opts),
    checkCourtListener(company, opts),
    checkEdgar(company, opts),
    checkGdelt(company, opts),
  ]);
  return [oc, cl, ed, gd];
}

export default async function DashboardPage() {
  const [sources, recent] = await Promise.all([probe(), Promise.resolve(recentChecks(10))]);
  const up = sources.filter((s) => s.ok).length;

  return (
    <main className={`${sans.className} bg-stone-50 text-stone-900`}>
      <header className="border-b border-stone-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="text-[17px] font-bold tracking-tight">
            Monad
          </Link>
          <p className={`${mono.className} text-xs text-stone-500`}>
            {up}/4 sources live
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-8">
        <h1 className="max-w-[20ch] text-4xl font-bold tracking-tight md:text-5xl">Model dashboard.</h1>
        <p className="mt-3 max-w-[58ch] text-[16px] leading-relaxed text-stone-600">
          Live source status, the modeled types, and recent checks. Everything here is measured now, nothing staged.
        </p>

        <h2 className="mt-12 text-xl font-bold">Sources</h2>
        <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
          {sources.map((s) => (
            <li key={s.source} className="flex items-baseline justify-between gap-4 py-4">
              <span>
                <span className="font-bold">{s.source}</span>{" "}
                <span className="text-sm text-stone-600">
                  {s.ok ? `${s.flags.length} flags` : (s.error ?? "unavailable")}
                </span>
              </span>
              <span className={`${mono.className} tnum shrink-0 text-xs ${s.ok ? "text-emerald-800" : "text-stone-500"}`}>
                {s.ok ? "live" : "degraded"} · {(s.latencyMs / 1000).toFixed(1)}s
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-xl font-bold">Modeled types</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TYPES.map((t, i) => (
            <div key={t.t} className={`rounded-2xl border p-5 ${i % 2 === 0 ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-100"}`}>
              <p className="text-lg font-bold">{t.t}</p>
              <p className="mt-1 text-[15px] text-stone-600">{t.d}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-bold">Recent checks</h2>
        {recent.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 p-6 text-[15px] text-stone-600">
            No checks yet on this server. Get the{" "}
            <Link href="/download" className="font-semibold text-emerald-800 underline underline-offset-4">
              Monad app
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 border-y border-stone-200">
            {recent.map((r, i) => (
              <li key={`${r.company}-${i}`} className="flex items-baseline justify-between gap-4 py-4">
                <span>
                  <span className="font-bold">{r.company}</span>{" "}
                  <span className={`text-sm font-semibold ${r.verdict === "FUND" ? "text-emerald-800" : "text-stone-900"}`}>
                    {r.verdict}
                  </span>{" "}
                  <span className={`${mono.className} tnum text-xs text-stone-500`}>score {r.score}</span>
                </span>
                <span className={`${mono.className} text-xs text-stone-500`}>
                  {r.evidence.length} flags{(r.degradedSources.length > 0) ? ` · ${r.degradedSources.length} sources down` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-stone-500 md:px-8">
          <p>Monad. One model. One line.</p>
          <Link href="/" className="transition-colors hover:text-stone-900">
            Back to overview
          </Link>
        </div>
      </footer>
    </main>
  );
}
