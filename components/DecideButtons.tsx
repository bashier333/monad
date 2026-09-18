"use client";

import { useState } from "react";

export default function DecideButtons({ id, status }: { id: string; status: string }) {
  const [state, setState] = useState("");

  async function decide(approve: boolean) {
    setState("working");
    const res = await fetch(`/api/corrections/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    if (res.ok) window.location.reload();
    else setState("failed");
  }

  async function revert() {
    setState("working");
    const res = await fetch(`/api/corrections/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revert: true }),
    });
    if (res.ok) window.location.reload();
    else setState("failed");
  }

  if (status === "applied") {
    return (
      <span className="flex gap-2">
        <button onClick={revert} className="rounded border px-2 py-1 text-xs">
          Revert
        </button>
        {state === "working" && <span className="text-xs">…</span>}
        {state === "failed" && <span className="text-xs text-red-600">failed</span>}
      </span>
    );
  }

  return (
    <span className="flex gap-2">
      <button onClick={() => decide(true)} className="rounded bg-black px-2 py-1 text-xs text-white">
        Apply
      </button>
      <button onClick={() => decide(false)} className="rounded border px-2 py-1 text-xs">
        Reject
      </button>
      {state === "working" && <span className="text-xs">…</span>}
      {state === "failed" && <span className="text-xs text-red-600">failed</span>}
    </span>
  );
}
