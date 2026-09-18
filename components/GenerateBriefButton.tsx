"use client";

import { useState } from "react";

export default function GenerateBriefButton() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/briefs/generate", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      const body = (await res.json()) as { brief?: { weekStart: string } };
      window.location.href = `/briefs/${body.brief?.weekStart ?? ""}`;
    } else {
      setMsg("generation failed");
    }
  }

  return (
    <span>
      <button onClick={run} disabled={busy} className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50">
        {busy ? "Generating…" : "Generate this week's brief"}
      </button>
      {msg && <span className="ml-2 text-sm text-red-600">{msg}</span>}
    </span>
  );
}
