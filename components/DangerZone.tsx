"use client";

import { useState } from "react";

export default function DangerZone({ slug }: { slug: string }) {
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  async function wipe() {
    setMsg("");
    const res = await fetch("/api/org/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const body = (await res.json()) as { error?: string };
    setMsg(res.ok ? "All organization data deleted." : (body.error ?? "failed"));
    if (res.ok) setConfirm("");
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        <a href="/api/org/data" className="underline">
          Download everything (JSON)
        </a>
      </p>
      <div className="rounded border border-red-400 p-3">
        <p className="font-medium">Delete all organization data</p>
        <p className="text-gray-600">Type your org slug ({slug}) to confirm. Members keep access; data does not come back.</p>
        <div className="mt-2 flex gap-2">
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={slug} className="rounded border p-1" />
          <button onClick={wipe} className="rounded bg-red-600 px-3 py-1 text-white">
            Delete everything
          </button>
        </div>
        {msg && <p className="mt-1">{msg}</p>}
      </div>
    </div>
  );
}
