"use client";

import { useState } from "react";

export default function RuleToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !on }),
    });
    setBusy(false);
    if (res.ok) setOn(!on);
  }

  return (
    <button onClick={toggle} disabled={busy} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
      {on ? "Disable" : "Enable"}
    </button>
  );
}
