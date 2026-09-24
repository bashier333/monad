"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function RuleForm({ week, pack = "freight" }: { week: string; pack?: "freight" | "agency" }) {
  const sp = useSearchParams();
  const costKinds = pack === "agency" ? ["labor", "rush", "asset"] : ["detention", "fee", "fuel"];
  const matchFields =
    pack === "agency"
      ? ["client", "project", "round", "person", "date", "hours", "amount", "loadKey"]
      : ["driver", "origin", "destination", "broker", "truck", "loadKey", "lane", "date", "revenue", "miles"];
  const [costKind, setCostKind] = useState(costKinds[0]);
  const [matchField, setMatchField] = useState(pack === "agency" ? "client" : "driver");
  const [matchValue, setMatchValue] = useState(sp.get("matchValue") ?? "");
  const [toLoad, setToLoad] = useState(sp.get("toLoad") ?? "EXCLUDE");
  const [reason, setReason] = useState(sp.get("reason") ?? "");
  const sourceCorrectionId = sp.get("fromCorrection") ?? "";
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function doPreview() {
    setMsg("");
    const res = await fetch("/api/rules/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule: { kind: "reattribute", costKind, matchField, matchValue, toLoad, reason }, week, pack }),
    });
    const body = (await res.json()) as { affectedLoads?: number; adjustments?: number; totalMoved?: number; pctOfWeeklyCost?: number; laneDeltas?: Array<{ lane: string; delta: number }>; groupDeltas?: Array<{ group: string; delta: number }>; sample?: string[]; error?: string };
    const deltas = (body.groupDeltas ?? body.laneDeltas ?? []).map((d) => {
      const name = "group" in d ? (d as { group: string }).group : (d as { lane: string }).lane;
      return `${name} ${d.delta >= 0 ? "+" : ""}${d.delta}`;
    });
    setPreview(res.ok ? `${body.affectedLoads} loads, $${body.totalMoved ?? 0} moved (${body.pctOfWeeklyCost ?? 0}% of weekly cost). ${deltas.join(" | ")}${(body.pctOfWeeklyCost ?? 0) > 25 ? " — WARNING: moves >25% of weekly cost" : ""}` : (body.error ?? "preview failed"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costKind, matchField, matchValue, toLoad, reason, pack, sourceCorrectionId: sourceCorrectionId || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) window.location.reload();
      else setMsg(body.error ?? "Save failed. Try again.");
    } catch {
      setMsg("Save failed. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded border p-4 text-sm">
      <h2 className="font-medium">New standing rule</h2>
      <div className="flex flex-wrap gap-2">
        <select value={costKind} onChange={(e) => setCostKind(e.target.value)} className="rounded border p-1">
          {costKinds.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select value={matchField} onChange={(e) => setMatchField(e.target.value)} className="rounded border p-1">
          {matchFields.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="matches value, e.g. Deshawn" className="rounded border p-1" />
        <input value={toLoad} onChange={(e) => setToLoad(e.target.value)} placeholder="move to load # or EXCLUDE" className="rounded border p-1" />
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="reason" className="rounded border p-1" />
      <div className="flex gap-2">
        <button type="button" onClick={doPreview} className="rounded border px-3 py-1">
          Preview on this week
        </button>
        <button type="submit" disabled={busy} className="rounded-md font-medium px-3 py-1 text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {busy ? "Saving…" : "Save rule"}
        </button>
      </div>
      {preview && <p className="ds-text-2">{preview}</p>}
      {msg && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {msg}
        </p>
      )}
    </form>
  );
}
