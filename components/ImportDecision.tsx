"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Duplicate/overlap decision: conflict counts up front, no full-page
// reload (router.refresh keeps scroll and context).
export default function ImportDecision({
  runId,
  note,
  conflictCount,
}: {
  runId: string;
  note: string | null;
  conflictCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "failed" | "done">("idle");
  const [choice, setChoice] = useState("");

  async function decide(decision: string) {
    setState("working");
    const res = await fetch(`/api/imports/${runId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setChoice(decision);
      setState("done");
      router.refresh();
    } else {
      setState("failed");
    }
  }

  return (
    <div className="rounded border p-4 ds-panel" style={{ borderColor: "var(--warn)" }}>
      <h2 className="font-medium ds-text">Review needed</h2>
      <p className="mt-1 text-sm ds-text-2">
        {note ?? "Possible duplicate or overlapping import."}{" "}
        {conflictCount > 0 && (
          <span>
            {conflictCount} conflicting record{conflictCount === 1 ? "" : "s"} listed below — merge keeps
            both sides, replace drops the overlapped rows, skip discards this file.
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => void decide("merge")}
          disabled={state === "working"}
          className="ds-control rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          Merge as new
        </button>
        <button
          onClick={() => void decide("replace")}
          disabled={state === "working"}
          className="ds-control rounded border px-3 py-1 text-sm ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          Replace overlapped
        </button>
        <button
          onClick={() => void decide("skip")}
          disabled={state === "working"}
          className="ds-control rounded border px-3 py-1 text-sm ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          Skip import
        </button>
      </div>
      {state === "working" && <p className="mt-2 text-sm ds-text-2">Working…</p>}
      {state === "failed" && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          Decision failed — try again.
        </p>
      )}
      {state === "done" && <p className="mt-2 text-sm ds-text-2">Decided: {choice}. Page updated.</p>}
    </div>
  );
}
