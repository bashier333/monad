"use client";

import { useState } from "react";
import { trackFunnel } from "@/lib/analytics";

// Team checkout control: monthly/annual toggle (annual = separate Stripe
// price, −20%), coupon code, 14-day trial note. Posts straight to checkout;
// backend 501s honestly when annual isn't configured.
export default function PricingCta({ annualAvailable }: { annualAvailable: boolean }) {
  const [annual, setAnnual] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function checkout() {
    setBusy(true);
    setMsg("");
    trackFunnel("upgrade_clicked", { from: "pricing", annual, coupon: coupon ? "yes" : "no" });
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annual: annual && annualAvailable,
          trialDays: 14,
          couponId: coupon.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
      } else {
        setMsg(body.error ?? "checkout failed — try again");
      }
    } catch {
      setMsg("checkout failed — check your connection and try again");
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 space-y-2">
      {annualAvailable && (
        <div className="flex gap-1 text-sm" role="group" aria-label="Billing period">
          {(["monthly", "annual"] as const).map((p) => {
            const active = annual === (p === "annual");
            return (
              <button
                key={p}
                type="button"
                onClick={() => setAnnual(p === "annual")}
                aria-pressed={active}
                className="ds-state rounded border px-3 py-1 ds-text"
                style={
                  active
                    ? { borderColor: "var(--accent)", background: "var(--accent)", color: "#141413", fontWeight: 500 }
                    : { borderColor: "var(--hairline)" }
                }
              >
                {p === "annual" ? "Annual −20%" : "Monthly"}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="pricing-coupon">Coupon code (optional)</label>
        <input
          id="pricing-coupon"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Coupon (optional)"
          autoComplete="off"
          className="ds-control rounded border px-2 py-1 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <button
          type="button"
          onClick={() => void checkout()}
          disabled={busy}
          className="ds-control rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#141413" }}
        >
          {busy ? "…" : "Upgrade to Team"}
        </button>
      </div>
      <p className="text-xs ds-text-2">14-day trial included. Tax calculated at checkout.</p>
      {msg && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
