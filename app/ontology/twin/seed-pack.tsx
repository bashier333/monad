"use client";

import { useState } from "react";

export default function SeedPack() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function seed() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/ontology/packs/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack: "manufacturing" }),
      });
      const body = (await res.json()) as {
        ontology?: { types: number; links: number; policies: number };
        actions?: Array<{ ok: boolean }>;
        error?: string;
      };
      if (!res.ok) {
        setMessage(body.error ?? "seed failed");
        return;
      }
      const actions = body.actions?.filter((a) => a.ok).length ?? 0;
      setMessage(
        `Seeded: ${body.ontology?.types ?? 0} types, ${body.ontology?.links ?? 0} links, ${body.ontology?.policies ?? 0} policies, ${actions} actions.`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <p className="text-sm ds-text-2">{message}</p>}
      <button onClick={() => void seed()} disabled={busy} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">
        Seed manufacturing pack
      </button>
    </div>
  );
}
