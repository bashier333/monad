"use client";

import { useState } from "react";

const GUIDES = [
  { id: "upload", title: "1. Upload an export" },
  { id: "read", title: "2. Read an answer" },
  { id: "correct", title: "3. Correct a cost" },
  { id: "agency", title: "4. Agency pack: project margins" },
];

export default function HelpSearch({ children }: { children: React.ReactNode }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter guides…"
        aria-label="Filter help guides"
        className="w-full rounded border p-2 text-sm"
      />
      {GUIDES.filter((g) => g.title.toLowerCase().includes(query)).map((g) => (
        <div key={g.id} data-guide={g.id}>
          {(Array.isArray(children) ? children : [children]).filter(
            (c) => (c as React.ReactElement<{ id?: string }>)?.props?.id === g.id,
          )}
        </div>
      ))}
      {GUIDES.every((g) => !g.title.toLowerCase().includes(query)) && (
        <p className="text-sm ds-text-2">No guides match “{q}”.</p>
      )}
    </div>
  );
}
