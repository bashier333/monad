"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Week re-run: applies open corrections, then refreshes so the new margins
// render immediately (no stale numbers, no manual reload).
export default function RecomputeButton({ week, pack = "freight" }: { week: string; pack?: "freight" | "agency" }) {
  const router = useRouter();
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/answers/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, pack }),
      });
      if (res.ok) {
        const body = (await res.json()) as { appliedCorrections?: number; adjustments?: Array<{ description: string }> };
        const lines = (body.adjustments ?? []).map((a) => a.description).join(" | ");
        setResult(`${body.appliedCorrections ?? 0} corrections applied. ${lines || "No adjustments this week."}`);
        router.refresh();
      } else {
        setResult("re-run failed — try again");
      }
    } catch {
      setResult("re-run failed — check your connection and try again");
    }
    setBusy(false);
  }

  return (
    <div className="text-sm">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="ds-control rounded border px-3 py-1 ds-text disabled:opacity-50"
        style={{ borderColor: "var(--hairline)" }}
      >
        {busy ? "Re-running…" : "Re-run this week with my corrections"}
      </button>
      {result && (
        <p className="mt-1 ds-text-2" role="status">
          {result}
        </p>
      )}
    </div>
  );
}
