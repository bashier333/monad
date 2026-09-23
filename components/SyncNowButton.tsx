"use client";

import Link from "next/link";
import { useState } from "react";

// One-click connector pull: posts the connector key, reports the outcome,
// and points at the board where pulled rows land as explorable objects.
export default function SyncNowButton({ connectorKey }: { connectorKey: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function run() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/sync/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorKey }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; rowsUpserted?: number };
      if (res.ok) {
        setDone(true);
        setMsg(
          typeof body.rowsUpserted === "number" ? `${body.rowsUpserted} rows landed on your board.` : "Sync finished — see your board."
        );
      } else {
        setMsg(body.error ?? "sync failed");
      }
    } catch {
      setMsg("sync failed");
    }
    setBusy(false);
  }

  return (
    <span className="mt-2 block">
      {done ? (
        <Link href="/ontology/board" className="rounded border px-3 py-1 text-sm underline">
          See the board →
        </Link>
      ) : (
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? "Syncing…" : "Sync now"}
        </button>
      )}
      {msg && <span className="ml-2 text-[13px] ds-text-2">{msg}</span>}
    </span>
  );
}
