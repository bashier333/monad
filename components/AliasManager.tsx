"use client";

import { useEffect, useState } from "react";

interface Alias {
  id: string;
  alias: string;
  canonical: string;
}

export default function AliasManager() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [alias, setAlias] = useState("");
  const [canonical, setCanonical] = useState("");

  useEffect(() => {
    void fetch("/api/aliases")
      .then((r) => r.json())
      .then((b: { aliases?: Alias[] }) => setAliases(b.aliases ?? []));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias, canonical }),
    });
    if (res.ok) {
      setAlias("");
      setCanonical("");
      const b = (await (await fetch("/api/aliases")).json()) as { aliases?: Alias[] };
      setAliases(b.aliases ?? []);
    }
  }

  return (
    <div className="rounded border p-4 text-sm">
      <h2 className="font-medium">Place aliases (edits apply to every answer immediately)</h2>
      <ul className="mt-2 max-h-40 overflow-y-auto">
        {aliases.map((a) => (
          <li key={a.id} className="font-mono">
            {a.alias} → {a.canonical}
          </li>
        ))}
        {aliases.length === 0 && <li className="text-gray-500">No custom aliases yet.</li>}
      </ul>
      <form onSubmit={save} className="mt-2 flex flex-wrap gap-2">
        <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="alias, e.g. Big D" className="rounded border p-1" />
        <input value={canonical} onChange={(e) => setCanonical(e.target.value)} placeholder="canonical, e.g. Dallas TX" className="rounded border p-1" />
        <button type="submit" className="rounded bg-black px-3 py-1 text-white">
          Save alias
        </button>
      </form>
    </div>
  );
}
