"use client";

import { useState } from "react";

export default function VariantForm({ week }: { week: string }) {
  const [by, setBy] = useState("driver");
  const [key, setKey] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (key.trim()) {
          window.location.href = `/briefs/variant?by=${by}&key=${encodeURIComponent(key.trim())}&week=${week}`;
        }
      }}
      className="flex flex-wrap items-end gap-2 rounded border p-3 text-sm"
    >
      <span className="font-medium">Slice the brief:</span>
      <select value={by} onChange={(e) => setBy(e.target.value)} className="rounded border p-1">
        {["driver", "truck", "broker", "customer", "day", "month"].map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="name, date, or 'all'" className="rounded border p-1" />
      <button type="submit" className="rounded bg-black px-3 py-1 text-white">
        View
      </button>
    </form>
  );
}
