"use client";

import { useState } from "react";

export default function BulkFlag({ loads }: { loads: Array<{ loadKey: string; kinds: string[] }> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("wrong attribution");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function submit(mode: "top" | "all") {
    setBusy(true);
    setMsg("");
    const targets: Array<{ targetKey: string; field: string }> = [];
    for (const l of loads) {
      if (!selected.has(l.loadKey)) continue;
      const kinds = mode === "all" ? l.kinds : l.kinds.slice(0, 1);
      for (const k of kinds) targets.push({ targetKey: l.loadKey, field: k });
    }
    if (targets.length === 0) {
      setMsg("Select at least one load.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, newValue: "EXCLUDE", reason: `${reason} (bulk triage)` }),
    });
    setBusy(false);
    setMsg(res.ok ? `Flagged ${targets.length} lines for triage.` : "Flag failed.");
    if (res.ok) setSelected(new Set());
  }

  return (
    <div className="rounded border p-3 text-sm">
      <p className="font-medium">Bulk triage ({selected.size} selected)</p>
      <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {loads.map((l) => (
          <label key={l.loadKey} className="flex items-center gap-1 rounded border px-2 py-1 font-mono">
            <input type="checkbox" checked={selected.has(l.loadKey)} onChange={() => toggle(l.loadKey)} />
            {l.loadKey}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" className="rounded border p-1" />
        <button onClick={() => submit("top")} disabled={busy} className="rounded border px-2 py-1 disabled:opacity-50">
          Flag top line each
        </button>
        <button onClick={() => submit("all")} disabled={busy} className="rounded border px-2 py-1 disabled:opacity-50">
          Flag all lines
        </button>
      </div>
      {msg && <p className="mt-1 text-gray-700">{msg}</p>}
    </div>
  );
}
