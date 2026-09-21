"use client";

import { useState } from "react";

export default function VariantForm({ week, pack = "freight" }: { week: string; pack?: "freight" | "agency" }) {
  const options = pack === "agency" ? ["client", "producer", "day", "month"] : ["driver", "truck", "broker", "customer", "day", "month"];
  const [by, setBy] = useState(options[0]);
  const [key, setKey] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) {
          window.location.href = `/briefs/variant?pack=${pack}&by=${by}&key=${encodeURIComponent(key.trim())}&week=${week}`;
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded border p-3 text-sm"
    >
      <span className="font-medium">Slice the brief:</span>
      <select value={by} onChange={(e) => setBy(e.target.value)} className="rounded border p-1">
        {options.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="name, date, or 'all'" className="rounded border p-1" />
      <button type="submit" className="rounded-md font-medium px-3 py-1 text-white" style={{ background: "var(--accent)" }}>
        View
      </button>
    </form>
  );
}
