"use client";

import { useState } from "react";

export default function GraduateButton() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/demo/graduate", { method: "POST" });
    const body = (await res.json()) as { removed?: number; error?: string };
    setBusy(false);
    setMsg(res.ok ? `Graduated: ${body.removed ?? 0} sample runs removed, your mappings kept.` : (body.error ?? "failed"));
  }

  return (
    <p className="text-sm text-gray-600">
      <button onClick={run} disabled={busy} className="underline disabled:opacity-50">
        {busy ? "Graduating…" : "Done with samples? Graduate to real data (keeps mappings)"}
      </button>
      {msg && <span className="ml-2">{msg}</span>}
    </p>
  );
}
