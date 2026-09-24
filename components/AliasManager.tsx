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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/aliases")
      .then((r) => r.json())
      .then((b: { aliases?: Alias[] }) => setAliases(b.aliases ?? []));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!alias.trim() || !canonical.trim() || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, canonical }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setAlias("");
        setCanonical("");
        const b = (await (await fetch("/api/aliases")).json()) as { aliases?: Alias[] };
        setAliases(b.aliases ?? []);
        setMsg("Saved. Applies to every answer immediately.");
      } else {
        setMsg(body.error ?? "Save failed. Try again.");
      }
    } catch {
      setMsg("Save failed. Try again.");
    }
    setBusy(false);
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
        <button type="submit" disabled={busy} className="rounded-md font-medium px-3 py-1 text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {busy ? "Saving…" : "Save alias"}
        </button>
      </form>
      {msg && (
        <p role="status" className="mt-1 text-sm ds-text-2">
          {msg}
        </p>
      )}
    </div>
  );
}
