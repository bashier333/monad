"use client";

import { useEffect, useState } from "react";

export default function FleetSizePicker({ initial, pack = "freight" }: { initial: string; pack?: "freight" | "agency" }) {
  const [size, setSize] = useState(initial);
  const [msg, setMsg] = useState("");
  const key = pack === "agency" ? "teamSize" : "fleetSize";
  const options =
    pack === "agency"
      ? [
          ["solo", "Solo (just me)"],
          ["small", "Small studio (2–10 people)"],
          ["mid", "Mid studio (11–30 people)"],
          ["large", "Large studio (30+ people)"],
        ]
      : [
          ["owner-op", "Owner-operator (1 truck)"],
          ["small", "Small (2–20 trucks)"],
          ["mid", "Mid (21–150 trucks)"],
          ["large", "Large (150+ trucks)"],
        ];

  useEffect(() => {
    if (initial) setSize(initial);
  }, [initial]);

  async function save(v: string) {
    setSize(v);
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: v }),
    });
    setMsg(res.ok ? "Saved." : "Save failed.");
  }

  return (
    <span className="text-sm">
      {pack === "agency" ? "Team size:" : "Fleet size:"}{" "}
      <select value={size} onChange={(e) => save(e.target.value)} className="rounded border p-1">
        <option value="">— pick —</option>
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>{" "}
      {size === "owner-op" || size === "small" ? (
        <span className="ds-text-2">Tip: pick the size closest to your operation. It tunes thresholds and starter rules.</span>
      ) : null}
      {msg && <span className="ml-1">{msg}</span>}
    </span>
  );
}
