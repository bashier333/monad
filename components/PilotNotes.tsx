"use client";

import { useState } from "react";

export default function PilotNotes({ initial }: { initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/pilots/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setMsg(res.ok ? "Saved." : "Save failed. Try again.");
    } catch {
      setMsg("Save failed. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="space-y-2 text-sm">
      <h2 className="font-medium">Friction log + notes</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={5}
        placeholder="Every stall, confusion, and workaround from concierge onboarding goes here…"
        className="w-full rounded border p-2"
      />
      <button type="submit" disabled={busy} className="rounded-md font-medium px-3 py-1 text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {busy ? "Saving…" : "Save notes"}
      </button>
      {msg && <span role="status" className="ml-2">{msg}</span>}
    </form>
  );
}
