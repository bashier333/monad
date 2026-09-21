"use client";

import Link from "next/link";
import { useState } from "react";
import { useEscape } from "@/components/useEscape";
import { trackFunnel } from "@/lib/analytics";

const REASONS = ["wrong attribution", "shipper fault", "duplicate charge", "should not count", "other"];

// Flag dialog: no silent default. The reporter explicitly chooses Exclude
// (remove from margins) or a move target — blank submits nothing. Success
// links to the queue; the week re-run applies it.
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
  const [toLoad, setToLoad] = useState("");
  const [exclude, setExclude] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstFieldRef = useEscape<HTMLSelectElement>(() => setOpen(false));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const target = exclude ? "EXCLUDE" : toLoad.trim();
    if (!target) {
      setError("Choose “Exclude” or type a load number — nothing is assumed.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetKey: loadKey,
          field,
          oldValue,
          newValue: target,
          reason: note ? `${reason}: ${note}` : reason,
        }),
      });
      if (res.ok) {
        setDone(true);
        setOpen(false);
        trackFunnel("flag_created", { field });
      } else {
        setError("Flag failed — try again.");
      }
    } catch {
      setError("Flag failed — check your connection and try again.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <span className="text-xs ds-text-2">
        flagged ✓ — <Link href="/corrections" className="underline">view queue</Link>
      </span>
    );
  }

  return (
    <span className="text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)} className="underline ds-text-2">
        flag
      </button>
      {open && (
        <form
          onSubmit={(e) => void submit(e)}
          className="mt-1 flex flex-col gap-1 rounded border p-2 ds-panel"
          style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
        >
          <select
            ref={firstFieldRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded border p-1 ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
            aria-label="Reason"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 ds-text">
            <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
            Exclude from margins
          </label>
          {!exclude && (
            <input
              value={toLoad}
              onChange={(e) => setToLoad(e.target.value)}
              placeholder="move to load #"
              className="rounded border p-1 ds-text"
              style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
              aria-label="Move to load number"
            />
          )}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note (optional)"
            className="rounded border p-1 ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
            aria-label="Note"
          />
          <button
            type="submit"
            disabled={busy}
            className="ds-control rounded px-2 py-1 font-medium disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#141413" }}
          >
            {busy ? "…" : "Submit flag"}
          </button>
          {error && (
            <span role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
        </form>
      )}
    </span>
  );
}
