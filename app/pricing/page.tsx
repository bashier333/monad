import Link from "next/link";
import { PACK_PRICES, TIERS } from "@/lib/core/pricing";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Pricing</h1>
        <p className="mt-1 text-gray-600">Start free. Pay when the answer runs your Monday meeting.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {TIERS.map((t) => (
          <section
            key={t.id}
            className={`rounded border p-5 ${t.highlight ? "border-black shadow-sm" : ""}`}
          >
            <h2 className="font-medium">{t.name}</h2>
            <p className="mt-1 text-2xl font-bold">
              {t.price} <span className="text-sm font-normal text-gray-500">{t.unit}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">{t.blurb}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {t.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Link
              href={t.id === "analyst" ? "/api/auth/signin" : "/settings"}
              className={`mt-4 inline-block rounded px-4 py-2 text-sm ${t.highlight ? "bg-black text-white" : "border"}`}
            >
              {t.cta}
            </Link>
          </section>
        ))}
      </div>
      <p className="text-center text-xs text-gray-500">
        Team checkout price is configured in Stripe and reviewed against this page monthly
        (see pricing-check runbook). Cancel anytime — data kept 90 days with one-click export.
      </p>
      <div className="mx-auto max-w-2xl rounded border p-4 text-sm">
        <h2 className="font-medium">Per-pack Team pricing (one source: PACK_PRICES)</h2>
        <ul className="mt-1 list-disc pl-5 text-gray-700">
          {PACK_PRICES.map((p) => (
            <li key={p.pack}>
              {p.pack}: {p.team} — {p.note}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
