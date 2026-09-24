"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/primitives";
import { Confirm } from "@/components/Confirm";

// Duplicate/overlap decision: conflict counts up front, no full-page
// reload (router.refresh keeps scroll and context). Merge is one click;
// replace and skip destroy rows, so they confirm first.
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
  const [confirming, setConfirming] = useState<"replace" | "skip" | null>(null);

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
        <Button onClick={() => void decide("merge")} busy={state === "working"} disabled={state === "working"}>
          {state === "working" ? "Working…" : "Merge as new"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming("replace")} disabled={state === "working"}>
          Replace overlapped
        </Button>
        <Button variant="ghost" onClick={() => setConfirming("skip")} disabled={state === "working"}>
          Skip import
        </Button>
      </div>
      <Confirm
        open={confirming !== null}
        title={confirming === "replace" ? "Replace overlapped rows?" : "Skip this import?"}
        body={
          confirming === "replace"
            ? "Overlapped rows are dropped and replaced by this file. This cannot be undone."
            : "This file is discarded. Nothing is imported. This cannot be undone."
        }
        confirmLabel={confirming === "replace" ? "Replace" : "Skip"}
        busy={state === "working"}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) void decide(confirming);
          setConfirming(null);
        }}
      />
      {state === "working" && <p className="mt-2 text-sm ds-text-2">Working…</p>}
      {state === "failed" && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--danger)" }}>
          Decision failed. Try again.
        </p>
      )}
      {state === "done" && <p className="mt-2 text-sm ds-text-2">Decided: {choice}. Page updated.</p>}
    </div>
  );
}
