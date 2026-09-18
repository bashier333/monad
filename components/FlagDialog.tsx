"use client";

import { useState } from "react";
import { useEscape } from "@/components/useEscape";

const REASONS = ["wrong attribution", "shipper fault", "duplicate charge", "should not count", "other"];

export default function FlagDialog({
  loadKey,
  field,
  oldValue,
}: {
  loadKey: string;
  field: string;
  oldValue: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [toLoad, setToLoad] = useState("EXCLUDE");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const firstFieldRef = useEscape<HTMLSelectElement>(() => setOpen(false));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetKey: loadKey,
        field,
        oldValue,
        newValue: toLoad.trim() === "" ? "EXCLUDE" : toLoad.trim(),
        reason: note ? `${reason}: ${note}` : reason,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setOpen(false);
    }
  }

  if (done) return <span className="text-xs text-green-700">flagged ✓</span>;

  return (
    <span className="text-xs">
      <button onClick={() => setOpen((o) => !o)} className="underline">
        flag
      </button>
      {open && (
        <form onSubmit={submit} className="mt-1 flex flex-col gap-1 rounded border bg-white p-2">
          <select ref={firstFieldRef} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border p-1">
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            value={toLoad}
            onChange={(e) => setToLoad(e.target.value)}
            placeholder="move to load # or EXCLUDE"
            className="rounded border p-1"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note (optional)"
            className="rounded border p-1"
          />
          <button type="submit" disabled={busy} className="rounded bg-black px-2 py-1 text-white disabled:opacity-50">
            {busy ? "…" : "Submit flag"}
          </button>
        </form>
      )}
    </span>
  );
}
