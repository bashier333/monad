"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function RuleForm({ week }: { week: string }) {
  const sp = useSearchParams();
  const [costKind, setCostKind] = useState("detention");
  const [matchField, setMatchField] = useState("driver");
  const [matchValue, setMatchValue] = useState(sp.get("matchValue") ?? "");
  const [toLoad, setToLoad] = useState(sp.get("toLoad") ?? "EXCLUDE");
  const [reason, setReason] = useState(sp.get("reason") ?? "");
  const sourceCorrectionId = sp.get("fromCorrection") ?? "";
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState("");

  async function doPreview() {
    setMsg("");
    const res = await fetch("/api/rules/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule: { kind: "reattribute", costKind, matchField, matchValue, toLoad, reason }, week }),
    });
    const body = (await res.json()) as { affectedLoads?: number; adjustments?: number; totalMoved?: number; pctOfWeeklyCost?: number; laneDeltas?: Array<{ lane: string; delta: number }>; sample?: string[]; error?: string };
    setPreview(res.ok ? `${body.affectedLoads} loads, $${body.totalMoved ?? 0} moved (${body.pctOfWeeklyCost ?? 0}% of weekly cost). ${(body.laneDeltas ?? []).map((d) => `${d.lane} ${d.delta >= 0 ? "+" : ""}${d.delta}`).join(" | ")}` : (body.error ?? "preview failed"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costKind, matchField, matchValue, toLoad, reason, sourceCorrectionId: sourceCorrectionId || undefined }),
    });
    if (res.ok) window.location.reload();
    else setMsg("save failed");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded border p-4 text-sm">
      <h2 className="font-medium">New standing rule</h2>
      <div className="flex flex-wrap gap-2">
        <select value={costKind} onChange={(e) => setCostKind(e.target.value)} className="rounded border p-1">
          {["detention", "fee", "fuel"].map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <select value={matchField} onChange={(e) => setMatchField(e.target.value)} className="rounded border p-1">
          {["driver", "origin", "destination", "broker", "truck", "loadKey", "lane", "date", "revenue", "miles"].map((f) => (
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
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          Save rule
        </button>
      </div>
      {preview && <p className="text-gray-700">{preview}</p>}
      {msg && <p className="text-red-600">{msg}</p>}
    </form>
  );
}
