"use client";

import { useEffect, useState } from "react";

// Past-due banner: shows on app routes when the subscription needs payment.
// Read-only starts at day 21 per the dunning runbook — the banner says so
// and links straight to the Stripe portal. Silent when all is well.
export default function BillingBanner() {
  const [pastDue, setPastDue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { status?: string; readOnly?: boolean } | null) => {
        if (b && (b.status === "past_due" || b.readOnly)) setPastDue(true);
      })
      .catch(() => undefined);
  }, []);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && body.url) window.location.href = body.url;
    } catch {
      /* portal failed: banner stays */
    }
    setBusy(false);
  }

  if (!pastDue) return null;
  return (
    <p role="alert" className="px-4 py-2 text-center text-sm" style={{ background: "var(--warn)", color: "#141413" }}>
      Payment failed — update payment to keep making changes. Read-only starts at day 21; your data is safe.{" "}
      <button type="button" onClick={() => void retry()} disabled={busy} className="font-medium underline disabled:opacity-50">
        {busy ? "Opening…" : "Retry payment now"}
      </button>
    </p>
  );
}
