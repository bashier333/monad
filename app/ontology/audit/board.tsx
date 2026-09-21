"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import ObjectPicker, { type PickedObject } from "@/components/ObjectPicker";

interface AuditEvent {
  id: string;
  kind: string;
  objectId: string;
  actorId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  prevHash: string;
  hash: string;
  createdAt: string;
}

// Audit board: actor column, expandable before→after diff, copy-hash,
// CSV/JSON export of the loaded window, object timeline via picker or
// ?objectId= deep-link (see the drawer in Explore).
export default function AuditBoard({
  initial,
  chain,
  initialObjectId,
}: {
  initial: AuditEvent[];
  chain: { ok: boolean; checked: number; brokenAt: string | null };
  initialObjectId: string;
}) {
  const [events, setEvents] = useState(initial);
  const [picked, setPicked] = useState<PickedObject | null>(null);
  const [rawId, setRawId] = useState(initialObjectId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; checked: number; brokenAt: string | null; checkpointId?: string | null } | null>(chain);

  async function filter(objectId: string) {
    const params = new URLSearchParams({ take: "200" });
    if (objectId.trim()) params.set("objectId", objectId.trim());
    const res = await fetch(`/api/ontology/events?${params.toString()}`);
    if (!res.ok) return;
    const body = (await res.json()) as { events: AuditEvent[] };
    setEvents(body.events);
    const url = new URL(window.location.href);
    if (objectId.trim()) url.searchParams.set("objectId", objectId.trim());
    else url.searchParams.delete("objectId");
    window.history.replaceState(null, "", url.toString());
  }

  async function reverify(tail: boolean) {
    setStatus(null);
    const res = await fetch(`/api/ontology/audit/verify${tail ? "?tail=1" : ""}`);
    if (!res.ok) return;
    setStatus((await res.json()) as { ok: boolean; checked: number; brokenAt: string | null; checkpointId?: string | null });
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function download(kind: "csv" | "json") {
    const name = `audit-${new Date().toISOString().slice(0, 10)}.${kind}`;
    const body =
      kind === "json"
        ? JSON.stringify(events, null, 2)
        : ["when,kind,object,actor,hash,prev",
            ...events.map((e) =>
              [e.createdAt, e.kind, e.objectId, e.actorId, e.hash, e.prevHash]
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(",")
            ),
          ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const short = (h: string) => (h ? `${h.slice(0, 10)}…` : "—");
  const actorShort = (a: string) => (a ? `${a.slice(0, 8)}…` : "—");

  function diff(e: AuditEvent): Array<{ key: string; from: string; to: string }> {
    const before = e.before ?? {};
    const after = e.after ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().slice(0, 20);
    return keys
      .map((k) => ({ key: k, from: JSON.stringify(before[k] ?? null), to: JSON.stringify(after[k] ?? null) }))
      .filter((d) => d.from !== d.to);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded ds-panel p-3 text-sm">
        {status ? (
          status.ok ? (
            <span style={{ color: "var(--success)" }}>
              Chain verified: {status.checked} events, no breaks.
              {status.checkpointId ? ` Anchored at checkpoint ${status.checkpointId.slice(0, 8)}… (tail verify — schedule a full pass periodically).` : " Full pass from genesis."}
            </span>
          ) : (
            <span style={{ color: "var(--danger)" }}>Broken at {status.brokenAt} ({status.checked} events checked).</span>
          )
        ) : (
          <span className="ds-text-2">Verifying…</span>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => void reverify(true)} className="ds-state rounded border px-3 py-1.5 ds-text" style={{ borderColor: "var(--hairline)" }}>
            Verify recent
          </button>
          <button onClick={() => void reverify(false)} className="ds-state rounded border px-3 py-1.5 ds-text" style={{ borderColor: "var(--hairline)" }}>
            Verify full chain
          </button>
          <button onClick={() => download("csv")} className="ds-state rounded border px-3 py-1.5 ds-text" style={{ borderColor: "var(--hairline)" }}>
            Export CSV
          </button>
          <button onClick={() => download("json")} className="ds-state rounded border px-3 py-1.5 ds-text" style={{ borderColor: "var(--hairline)" }}>
            Export JSON
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-64 flex-1">
          <ObjectPicker
            picked={picked}
            onPick={(o) => {
              setPicked(o);
              setRawId(o?.id ?? "");
              void filter(o?.id ?? "");
            }}
          />
        </div>
        <input
          value={rawId}
          onChange={(e) => setRawId(e.target.value)}
          placeholder="or paste an object id"
          aria-label="Filter by object id"
          className="min-w-48 flex-1 rounded border px-3 py-2 font-mono text-xs ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <button onClick={() => void filter(rawId)} className="ds-state whitespace-nowrap rounded border px-4 py-2 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
          Filter
        </button>
        {(picked || rawId) && (
          <button
            onClick={() => { setPicked(null); setRawId(""); void filter(""); }}
            className="ds-state whitespace-nowrap rounded border px-4 py-2 text-sm ds-text-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            Clear
          </button>
        )}
      </div>
      {events.length === 0 ? (
        <p className="rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No events.</p>
      ) : (
        <div className="overflow-x-auto rounded ds-panel" role="region" aria-label="Audit events" tabIndex={0}>
          <table className="ds-table w-full min-w-[820px] text-sm">
            <thead className="sticky top-0" style={{ background: "var(--panel)" }}>
              <tr className="text-left">
                <th scope="col" className="px-2 font-medium ds-text-2">When</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Kind</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Object</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Actor</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Hash</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Prev</th>
                <th scope="col" className="px-2 font-medium ds-text-2">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--hairline)" }}>
              {events.map((e) => {
                const d = diff(e);
                const isOpen = expanded.has(e.id);
                return (
                  <Fragment key={e.id}>
                    <tr className="ds-state">
                      <td className="px-2 py-1 ds-text-2">{e.createdAt.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-2 font-medium ds-text">{e.kind}</td>
                      <td className="px-2">
                        {e.objectId ? (
                          <Link href={`/ontology/explore?id=${encodeURIComponent(e.objectId)}`} className="font-mono text-xs underline ds-text">
                            {short(e.objectId)}
                          </Link>
                        ) : (
                          <span className="ds-text-2">—</span>
                        )}
                      </td>
                      <td title={e.actorId} className="px-2 font-mono text-xs ds-text-2">{actorShort(e.actorId)}</td>
                      <td title={e.hash} className="px-2 font-mono text-xs ds-text">
                        <button type="button" onClick={() => void copyHash(e.hash)} title="Copy full hash" className="underline">
                          {short(e.hash)}
                        </button>
                        {copied === e.hash && <span className="ml-1 ds-text-2">copied</span>}
                      </td>
                      <td title={e.prevHash} className="px-2 font-mono text-xs ds-text-2">{short(e.prevHash)}</td>
                      <td className="px-2">
                        {d.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggle(e.id)}
                            aria-expanded={isOpen}
                            className="underline ds-text"
                          >
                            {isOpen ? "hide" : `${d.length} field${d.length === 1 ? "" : "s"}`}
                          </button>
                        ) : (
                          <span className="ds-text-2">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${e.id}-diff`} className="ds-panel-2">
                        <td colSpan={7} className="px-2 py-2">
                          <ul className="space-y-0.5 font-mono text-xs ds-text">
                            {d.map((x) => (
                              <li key={x.key}>
                                <span className="ds-text-2">{x.key}:</span> {x.from} → {x.to}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
