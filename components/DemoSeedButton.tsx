"use client";

import { useState } from "react";

export default function DemoSeedButton({ pack = "default", label }: { pack?: string; label?: string }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/demo/seed${pack === "default" ? "" : `?pack=${pack}`}`, { method: "POST" });
    const body = (await res.json()) as { runs?: string[]; skipped?: boolean; error?: string };
    setBusy(false);
    if (res.ok) {
      setMsg(body.skipped ? "Sample week already loaded." : "Sample week loading — check import history in a moment.");
      if (!body.skipped) setTimeout(() => window.location.reload(), 1500);
    } else {
      setMsg(body.error ?? "seed failed");
    }
  }

  return (
    <span>
      <button onClick={run} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-50">
        {busy ? "Loading…" : (label ?? "Explore with a sample week")}
      </button>
      {msg && <span className="ml-2 text-sm text-gray-600">{msg}</span>}
    </span>
  );
}
