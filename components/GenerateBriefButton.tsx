"use client";

import { useState } from "react";

export default function GenerateBriefButton({ pack = "freight" }: { pack?: "freight" | "agency" }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("Generating — crunching the week, usually under a minute…");
    try {
      const res = await fetch("/api/briefs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      if (res.ok) {
        const body = (await res.json()) as { brief?: { weekStart: string } };
        window.location.href = `/briefs/${body.brief?.weekStart ?? ""}?pack=${pack}`;
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(body.error ?? "generation failed — try again");
      }
    } catch {
      setMsg("generation failed — check your connection and try again");
    }
    setBusy(false);
  }

  return (
    <span>
      <button
        onClick={() => void run()}
        disabled={busy}
        className="ds-control rounded px-3 py-1 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#ffffff" }}
      >
        {busy ? "Generating…" : "Generate this week's brief"}
      </button>
      {msg && (
        <span className="ml-2 text-sm ds-text-2" role="status">
          {msg}
        </span>
      )}
    </span>
  );
}
