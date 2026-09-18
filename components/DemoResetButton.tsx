"use client";

import { useState } from "react";

export default function DemoResetButton({ slug }: { slug: string }) {
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");

  async function reset() {
    setMsg("");
    const res = await fetch("/api/org/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    const body = (await res.json()) as { error?: string };
    setMsg(res.ok ? "Demo wiped clean. Upload fresh whenever ready." : (body.error ?? "failed"));
    if (res.ok) setConfirm("");
  }

  return (
    <span className="text-sm">
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={`type ${slug} to reset demo`}
        className="rounded border p-1"
      />{" "}
      <button onClick={reset} className="rounded border px-2 py-1">
        Reset demo
      </button>
      {msg && <span className="ml-2">{msg}</span>}
    </span>
  );
}
