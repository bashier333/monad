"use client";

import { useState } from "react";

export default function MeetingConfirm({ confirmedAt }: { confirmedAt: string | null }) {
  const [done, setDone] = useState(!!confirmedAt);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/pilots/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUsed: true }),
      });
      if (res.ok) setDone(true);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  if (done) return <span className="text-sm" style={{ color: "var(--success)" }}>Confirmed ✓. The answer made the Monday meeting.</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={confirm} disabled={busy} className="rounded-md font-medium px-3 py-1 text-sm text-white disabled:opacity-50">
        {busy ? "…" : "Confirm: we used this answer in our Monday meeting"}
      </button>
      {failed && (
        <span role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          Did not save. Try again.
        </span>
      )}
    </span>
  );
}
