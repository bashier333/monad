"use client";

import { useState } from "react";
import { Button, Field } from "@/components/primitives";

export default function DangerZone({ slug }: { slug: string }) {
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const armed = confirm.trim() === slug;

  async function wipe() {
    if (!armed || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/org/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? "All organization data deleted." : (body.error ?? "Delete failed. Nothing was removed."));
      if (res.ok) setConfirm("");
    } catch {
      setMsg("Delete failed. Nothing was removed.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        <a href="/api/org/data" className="underline">
          Download everything (JSON)
        </a>
      </p>
      <div className="rounded-[10px] border p-3" style={{ borderColor: "var(--danger)" }}>
        <p className="font-medium ds-text">Delete all organization data</p>
        <p className="ds-text-2">Type your org slug ({slug}) to confirm. Members keep access; data does not come back.</p>
        <div className="mt-2 flex gap-2">
          <Field label={`Type ${slug} to confirm`}>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={slug}
              autoComplete="off"
              className="ds-control w-full rounded-md border px-3 py-2 text-sm ds-text"
              style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
            />
          </Field>
          <span className="self-end">
            <Button variant="danger" busy={busy} disabled={!armed || busy} onClick={() => void wipe()}>
              {busy ? "Deleting…" : "Delete everything"}
            </Button>
          </span>
        </div>
        {msg && (
          <p role="status" className="mt-1">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
