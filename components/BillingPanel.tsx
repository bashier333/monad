"use client";

import { useEffect, useState } from "react";

interface Status {
  tier: string;
  status: string;
  readOnly: boolean;
  limits: { uploadsPerMonth: number; historyDays: number };
  usage: { uploadsThisMonth: number };
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  date: string;
  pdf: string | null;
}

export default function BillingPanel() {
  const [s, setS] = useState<Status | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [reason, setReason] = useState("too-expensive");

  useEffect(() => {
    void fetch("/api/billing/status")
      .then((r) => r.json())
      .then((b: Status) => setS(b));
    void fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((b: { invoices?: Invoice[] }) => setInvoices(b.invoices ?? []));
  }, []);

  async function post(path: string) {
    setMsg("");
    const res = await fetch(path, { method: "POST" });
    const body = (await res.json()) as { url?: string; error?: string };
    if (res.ok && body.url) window.location.href = body.url;
    else if (res.ok) window.location.reload();
    else setMsg(body.error ?? "failed");
  }

  if (!s) return <p className="text-sm">Loading billing…</p>;

  return (
    <div className="space-y-2 text-sm">
      <p>
        Plan: <strong>{s.tier}</strong> ({s.status})
        {s.readOnly && <span className="text-red-600"> — read-only until payment is updated. Data is safe.</span>}
        {s.status === "past_due" && !s.readOnly && (
          <span> — payment failed; <button onClick={() => post("/api/billing/portal")} className="underline">retry now</button> to avoid read-only.</span>
        )}
      </p>
      {s.status === "canceled" && (
        <p className="rounded border p-2 ds-panel" style={{ borderColor: "var(--warn)" }}>
          Subscription canceled — your data is kept for 90 days.{" "}
          <a href="/api/org/data" className="underline">
            Export everything now
          </a>
          . Changed your mind? Resubscribe below; nothing was touched.
        </p>
      )}
      <p className="text-gray-600">
        Free tier: {s.limits.uploadsPerMonth} uploads/month ({s.usage.uploadsThisMonth} used), {s.limits.historyDays}-day
        history.
      </p>
      <div className="flex gap-2">
        {s.tier === "free" ? (
          <button onClick={() => post("/api/billing/checkout")} className="rounded-md font-medium px-3 py-1 text-white" style={{ background: "var(--accent)" }}>
            Upgrade to Team
          </button>
        ) : (
          <button onClick={() => post("/api/billing/portal")} className="rounded border px-3 py-1">
            Manage billing
          </button>
        )}
      </div>
      {msg && <p className="text-red-600">{msg}</p>}
      {invoices.length > 0 && (
        <div>
          <p className="font-medium">Receipts</p>
          <ul>
            {invoices.map((inv) => (
              <li key={inv.id}>
                {inv.date} — ${inv.amount.toFixed(2)} {inv.currency.toUpperCase()} ({inv.status})
                {inv.pdf && (
                  <>
                    {" "}
                    <a href={inv.pdf} className="underline">PDF</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {s.tier !== "free" && !leaving && (
        <button onClick={() => setLeaving(true)} className="text-gray-500 underline">
          Thinking of leaving?
        </button>
      )}
      {s.tier !== "free" && (
        <button onClick={() => post("/api/billing/pause")} className="text-gray-500 underline">
          Pause instead (keeps everything, stops billing)
        </button>
      )}
      {leaving && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/billing/cancel-survey", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            });
            if (res.ok) {
              setLeaving(false);
              setMsg("Noted — you can cancel in Manage billing. Data stays 90 days with export.");
            }
          }}
          className="flex gap-2"
        >
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border p-1">
            {["too-expensive", "missing-feature", "switched-tool", "paused-ops", "other"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" className="rounded border px-2 py-1">
            Continue to cancel
          </button>
        </form>
      )}
    </div>
  );
}
