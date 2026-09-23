import Link from "next/link";
import MarketingHero from "@/components/MarketingHero";
import PricingCta from "@/components/PricingCta";
import { PACK_PRICES, TIERS } from "@/lib/core/pricing";

// Pricing: single source (TIERS + PACK_PRICES), monthly/annual toggle,
// per-terminal math, trial + coupon + tax notes, FAQ. Team checks out
// directly; Org/Enterprise go to support (no invented sales email).
// Annual checkout needs STRIPE_TEAM_ANNUAL_PRICE_ID — the toggle hides
// itself until the backend offers it.
const FAQS = [
  ["Is there a trial?", "Yes — 14 days on Team, then monthly or annual billing starts. Cancel in one click; nothing is touched."],
  ["What happens if I cancel?", "Your data is kept 90 days with one-click export. Resubscribe anytime; history restores intact."],
  ["What if payment fails?", "Nothing is deleted, ever. Read-only starts at day 21; one successful payment restores full access within minutes."],
  ["How is annual priced?", "Annual is 20% off monthly, billed once. Monthly stays for teams that prefer it."],
  ["Do you offer discounts?", "Coupon codes apply at checkout — ask on the support page if you were promised one."],
];

export default function PricingPage() {
  const annualAvailable = Boolean(process.env.STRIPE_TEAM_ANNUAL_PRICE_ID);
  return (
    <main className="space-y-6 pb-6 md:pb-10">
      <MarketingHero
        title="Pricing"
        sub="Start free. Pay when the answer runs your Monday meeting."
      >
        <Link href="/roi" className="underline ds-text text-sm">
          Estimate your savings first →
        </Link>
      </MarketingHero>
      <div className="mx-auto max-w-4xl space-y-6 px-6 md:px-10">
      <div className="grid gap-3 md:grid-cols-2">
        {TIERS.map((t) => (
          <section
            key={t.id}
            className="rounded border p-5 ds-panel"
            style={t.highlight ? { borderColor: "var(--accent)" } : { borderColor: "var(--hairline)" }}
          >
            <h2 className="font-medium ds-text">{t.name}</h2>
            <p className="mt-1 text-2xl font-bold ds-text">
              {t.id === "team" ? "$499+" : t.price}{" "}
              <span className="text-sm font-normal ds-text-2">{t.unit}</span>
            </p>
            <p className="mt-1 text-sm ds-text-2">{t.blurb}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm ds-text">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {t.id === "team" ? (
              <PricingCta annualAvailable={annualAvailable} />
            ) : t.id === "analyst" ? (
              <Link
                href="/signin"
                className="ds-control mt-4 inline-block rounded border px-4 py-2 text-sm ds-text"
                style={{ borderColor: "var(--hairline)" }}
              >
                {t.cta}
              </Link>
            ) : (
              <Link
                href="/support"
                className="ds-control mt-4 inline-block rounded border px-4 py-2 text-sm ds-text"
                style={{ borderColor: "var(--hairline)" }}
              >
                {t.cta}
              </Link>
            )}
          </section>
        ))}
      </div>
      <p className="text-center text-xs ds-text-2">
        Cancel anytime — data kept 90 days with one-click export.
      </p>
      <div className="mx-auto max-w-2xl rounded border p-4 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
        <h2 className="font-medium ds-text">Per-terminal Team pricing</h2>
        <ul className="mt-1 list-disc pl-5 ds-text-2">
          {PACK_PRICES.map((p) => (
            <li key={p.pack}>
              {p.pack}: {p.team} — {p.note}
            </li>
          ))}
        </ul>
        <p className="mt-2 ds-text-2">
          Example: 3 terminals on Team ≈ $1,497/mo monthly, ≈ $1,198/mo billed annually (−20%).
        </p>
      </div>
      <div className="mx-auto max-w-2xl space-y-2 text-sm">
        <h2 className="font-medium ds-text">Questions</h2>
        {FAQS.map(([q, a]) => (
          <details key={q} className="rounded border p-3 ds-panel" style={{ borderColor: "var(--hairline)" }}>
            <summary className="cursor-pointer font-medium ds-text">{q}</summary>
            <p className="mt-1 ds-text-2">{a}</p>
          </details>
        ))}
      </div>
      </div>
    </main>
  );
}
