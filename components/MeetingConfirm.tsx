"use client";

import { useState } from "react";

export default function MeetingConfirm({ confirmedAt }: { confirmedAt: string | null }) {
  const [done, setDone] = useState(!!confirmedAt);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const res = await fetch("/api/pilots/checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingUsed: true }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
  }

  if (done) return <span className="text-sm text-green-700">Confirmed ✓ — the answer made the Monday meeting.</span>;
  return (
    <button onClick={confirm} disabled={busy} className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50">
      {busy ? "…" : "Confirm: we used this answer in our Monday meeting"}
    </button>
  );
}
