"use client";

import { useEffect, useState } from "react";

export default function FleetSizePicker({ initial }: { initial: string }) {
  const [size, setSize] = useState(initial);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (initial) setSize(initial);
  }, [initial]);

  async function save(v: string) {
    setSize(v);
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fleetSize: v }),
    });
    setMsg(res.ok ? "Saved." : "Save failed.");
  }

  return (
    <span className="text-sm">
      Fleet size:{" "}
      <select value={size} onChange={(e) => save(e.target.value)} className="rounded border p-1">
        <option value="">— pick —</option>
        <option value="owner-op">Owner-operator (1 truck)</option>
        <option value="small">Small (2–20 trucks)</option>
        <option value="mid">Mid (21–150 trucks)</option>
        <option value="large">Large (150+ trucks)</option>
      </select>{" "}
      {size === "owner-op" || size === "small" ? (
        <span className="text-gray-600">Tip: the sample week is shaped like you — try it first.</span>
      ) : null}
      {msg && <span className="ml-1">{msg}</span>}
    </span>
  );
}
