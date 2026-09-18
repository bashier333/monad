"use client";

import { useState } from "react";

export default function RecomputeButton({ week }: { week: string }) {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const res = await fetch("/api/answers/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week }),
    });
    setBusy(false);
    if (res.ok) {
      const body = (await res.json()) as { appliedCorrections?: number; adjustments?: Array<{ description: string }> };
      const lines = (body.adjustments ?? []).map((a) => a.description).join(" | ");
      setResult(`${body.appliedCorrections ?? 0} corrections applied. ${lines || "No adjustments this week."}`);
    } else {
      setResult("re-run failed");
    }
  }

  return (
    <div className="text-sm">
      <button onClick={run} disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50">
        {busy ? "Re-running…" : "Re-run this week with my corrections"}
      </button>
      {result && <p className="mt-1 text-gray-700">{result}</p>}
    </div>
  );
}
