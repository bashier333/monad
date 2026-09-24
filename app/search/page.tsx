"use client";

import { useState } from "react";
import type { SearchHit } from "@/lib/core/search";

const RECENT_KEY = "recent-searches";

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [ms, setMs] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadRecent()));

  async function run(query: string, k: string) {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&kind=${k}`);
    setBusy(false);
    const body = (await res.json()) as { hits?: SearchHit[]; ms?: number; error?: string };
    if (!res.ok) {
      setErr(body.error ?? "search failed");
      return;
    }
    setHits(body.hits ?? []);
    setMs(body.ms ?? null);
    const next = [query, ...recent.filter((r) => r !== query)].slice(0, 8);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <h1 className="text-xl font-bold">Search everything</h1>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) void run(q.trim(), kind);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Project, lane, invoice… (typo-tolerant)"
          aria-label="Search everything"
          className="w-full rounded border p-2 text-sm"
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Search scope" className="rounded border p-2 text-sm">
          {["all", "record", "brief", "correction", "file"].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button className="rounded-md font-medium px-4 py-2 text-sm text-white" style={{ background: "var(--accent)" }} disabled={busy}>
          {busy ? "…" : "Search"}
        </button>
      </form>
      {recent.length > 0 && (
        <p className="text-sm ds-text-2">
          Recent:{" "}
          {recent.map((r) => (
            <button key={r} className="mr-2 underline" onClick={() => { setQ(r); void run(r, kind); }}>
              {r}
            </button>
          ))}
        </p>
      )}
      {err && <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      {ms !== null && <p className="text-xs ds-text-2">{hits.length} hits in {ms}ms</p>}
      <ul className="space-y-2 text-sm">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`} className="rounded border p-3">
            <span className="mr-2 rounded ds-panel-2 px-1 font-mono text-xs">{h.kind}</span>
            <a href={h.href} className="font-medium underline">
              {h.title}
            </a>
            <p className="mt-1 ds-text-2">{h.snippet}</p>
          </li>
        ))}
      </ul>
      {ms !== null && hits.length === 0 && !err && (
        <p className="text-sm ds-text-2">Nothing found. Try a project name, lane, or invoice number.</p>
      )}
    </main>
  );
}
