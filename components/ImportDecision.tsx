"use client";

import { useState } from "react";

export default function ImportDecision({ runId, note }: { runId: string; note: string | null }) {
  const [state, setState] = useState("");

  async function decide(decision: string) {
    setState("working");
    const res = await fetch(`/api/imports/${runId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) window.location.reload();
    else setState("failed");
  }

  return (
    <div className="rounded border border-amber-400 bg-amber-50 p-4">
      <h2 className="font-medium">Review needed</h2>
      <p className="mt-1 text-sm">{note ?? "Possible duplicate or overlapping import."}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => decide("merge")} className="rounded bg-black px-3 py-1 text-sm text-white">
          Merge as new
        </button>
        <button onClick={() => decide("replace")} className="rounded border px-3 py-1 text-sm">
          Replace overlapped
        </button>
        <button onClick={() => decide("skip")} className="rounded border px-3 py-1 text-sm">
          Skip import
        </button>
      </div>
      {state === "working" && <p className="mt-2 text-sm">Working…</p>}
      {state === "failed" && <p className="mt-2 text-sm text-red-600">Decision failed.</p>}
    </div>
  );
}
