"use client";

import { useState } from "react";

export default function RuleToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !on }),
      });
      if (res.ok) setOn(!on);
      else setError(true);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={toggle} disabled={busy} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
        {busy ? "…" : on ? "Disable" : "Enable"}
      </button>
      {error && (
        <span role="alert" className="text-xs" style={{ color: "var(--danger)" }}>
          Did not stick. Try again.
        </span>
      )}
    </span>
  );
}
