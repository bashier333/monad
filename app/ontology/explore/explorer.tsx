"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ObjectPicker, { type PickedObject } from "@/components/ObjectPicker";

interface Traverse {
  nodes: string[];
  edges: Array<{ fromId: string; linkKey: string; toId: string }>;
  truncated: boolean;
}

interface Hit {
  id: string;
  typeKey: string;
  key: string;
  score: number;
  matched?: "key" | "text" | "fuzzy";
}

const MATCH_LABEL: Record<string, string> = { key: "key match", text: "details match", fuzzy: "fuzzy match" };

async function labelsFor(ids: string[]): Promise<Map<string, { key: string; typeKey: string }>> {
  const map = new Map<string, { key: string; typeKey: string }>();
  if (ids.length === 0) return map;
  const res = await fetch(`/api/ontology/objects/by-ids?ids=${ids.map(encodeURIComponent).join(",")}`);
  if (!res.ok) return map;
  const body = (await res.json()) as { objects: Array<{ id: string; key: string; typeKey: string }> };
  for (const o of body.objects) map.set(o.id, { key: o.key, typeKey: o.typeKey });
  return map;
}

type Direction = "out" | "in" | "both";

function ExplorerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [picked, setPicked] = useState<PickedObject | null>(null);
  const [depth, setDepth] = useState(() => {
    const d = Number(params.get("depth") ?? 2);
    return Number.isFinite(d) ? Math.min(Math.max(d, 0), 4) : 2;
  });
  const [direction, setDirection] = useState<Direction>(() => {
    const d = params.get("dir");
    return d === "in" || d === "both" ? d : "out";
  });
  const [labels, setLabels] = useState<Map<string, { key: string; typeKey: string }>>(new Map());
  const [graph, setGraph] = useState<Traverse | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [facet, setFacet] = useState("");
  const [error, setError] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerFacts, setDrawerFacts] = useState<Record<string, unknown> | null>(null);

  // URL is the traversal state: ?id=&depth=&dir= survives reloads + shares.
  const syncUrl = useCallback((id: string | null, d: number, dir: Direction) => {
    const next = new URLSearchParams();
    if (id) next.set("id", id);
    next.set("depth", String(d));
    next.set("dir", dir);
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [router]);

  const open = useCallback(async (id: string, d: number, dir: Direction) => {
    setError("");
    const res = await fetch(
      `/api/ontology/traverse?startId=${encodeURIComponent(id)}&depth=${d}&direction=${dir}`
    );
    if (!res.ok) {
      setError("traversal failed");
      return;
    }
    const t = (await res.json()) as Traverse;
    setGraph(t);
    setLabels(await labelsFor(t.nodes.slice(0, 100)));
  }, []);

  const pick = useCallback((o: PickedObject | null, d: number, dir: Direction) => {
    setPicked(o);
    setGraph(null);
    setHits([]);
    setDrawerId(null);
    setDrawerFacts(null);
    syncUrl(o?.id ?? null, d, dir);
    if (o) void open(o.id, d, dir);
  }, [open, syncUrl]);

  const search = useCallback(async (query: string) => {
    setError("");
    setGraph(null);
    setPicked(null);
    setFacet("");
    const res = await fetch(`/api/ontology/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      setError("search failed");
      return;
    }
    const body = (await res.json()) as { hits?: Hit[] };
    const list = (body.hits ?? []).slice(0, 20);
    setHits(list);
    if (list.length === 0) setError(`no objects match "${query}"`);
  }, []);

  useEffect(() => {
    const id = params.get("id");
    if (id) {
      fetch(`/api/ontology/objects/by-ids?ids=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((b: { objects?: Array<{ id: string; key: string; typeKey: string }> }) => {
          const o = b.objects?.[0];
          if (!o) {
            setError("object not found");
            return;
          }
          setPicked({ id: o.id, key: o.key, typeKey: o.typeKey });
          void open(o.id, depth, direction);
        })
        .catch(() => undefined);
      return;
    }
    const q = params.get("q");
    if (!q) return;
    void search(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (picked) {
      syncUrl(picked.id, depth, direction);
      void open(picked.id, depth, direction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depth, direction]);

  // Node drawer: live facts + incident links + action/audit deep-links.
  useEffect(() => {
    if (!drawerId || !graph) {
      setDrawerFacts(null);
      return;
    }
    let live = true;
    fetch(`/api/ontology/objects/${encodeURIComponent(drawerId)}/facts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { state?: Record<string, unknown> } | null) => {
        if (live) setDrawerFacts(b && typeof b.state === "object" ? (b.state as Record<string, unknown>) : {});
      })
      .catch(() => {
        if (live) setDrawerFacts({});
      });
    return () => {
      live = false;
    };
  }, [drawerId, graph]);

  const label = (id: string) => labels.get(id)?.key ?? `${id.slice(0, 8)}…`;
  const facetTypes = [...new Set(hits.map((h) => h.typeKey))].sort();
  const shownHits = facet ? hits.filter((h) => h.typeKey === facet) : hits;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1">
          <ObjectPicker picked={picked} onPick={(o) => pick(o, depth, direction)} />
        </div>
        <label className="text-sm ds-text">
          Depth
          <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className="ml-2 rounded border px-2 py-2 ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}>
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm ds-text">
          Direction
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="ml-2 rounded border px-2 py-2 ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          >
            <option value="out">Out (what it points to)</option>
            <option value="in">In (what points to it)</option>
            <option value="both">Both</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {hits.length > 0 && !picked && (
        <div className="space-y-2">
          {facetTypes.length > 1 && (
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter results by type">
              <FacetChip active={facet === ""} label={`All (${hits.length})`} onClick={() => setFacet("")} />
              {facetTypes.map((t) => (
                <FacetChip
                  key={t}
                  active={facet === t}
                  label={`${t} (${hits.filter((h) => h.typeKey === t).length})`}
                  onClick={() => setFacet(facet === t ? "" : t)}
                />
              ))}
            </div>
          )}
          <ul className="divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {shownHits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => pick({ id: h.id, key: h.key, typeKey: h.typeKey }, depth, direction)}
                  className="ds-state flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm"
                >
                  <span className="font-medium ds-text">{h.key}</span>
                  <span className="font-mono text-xs ds-text-2">{h.typeKey}</span>
                  <span className="text-xs ds-text-2">· {MATCH_LABEL[h.matched ?? "text"]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {graph && (
        <div className="rounded ds-panel p-3 text-sm">
          <p className="font-medium ds-text">
            {graph.nodes.length} nodes, {graph.edges.length} edges
            {graph.truncated && <span className="ds-text-2"> (truncated)</span>}
          </p>
          <ul className="mt-2 space-y-1">
            {graph.edges.slice(0, 100).map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 ds-text-2">
                <button type="button" onClick={() => setDrawerId(e.fromId)} className="font-medium underline ds-text">
                  {label(e.fromId)}
                </button>
                <span className="rounded px-1 font-mono text-xs ds-panel-2">{e.linkKey}</span>
                <button type="button" onClick={() => setDrawerId(e.toId)} className="font-medium underline ds-text">
                  {label(e.toId)}
                </button>
                <Link href={`/ontology/actions?object=${encodeURIComponent(e.fromId)}`} className="underline ds-text">
                  act
                </Link>
              </li>
            ))}
          </ul>
          {graph.edges.length > 100 && (
            <p className="mt-1 text-xs ds-text-2">Showing 100 of {graph.edges.length} edges — narrow with direction or depth.</p>
          )}
          {picked && (
            <p className="mt-3">
              <Link
                href={`/ontology/actions?object=${encodeURIComponent(picked.id)}`}
                className="rounded px-3 py-1.5 text-[#141413]"
                style={{ background: "var(--accent)" }}
              >
                Apply action to {picked.key}
              </Link>
            </p>
          )}
        </div>
      )}
      {drawerId && graph && (
        <div className="rounded ds-panel p-3 text-sm" role="dialog" aria-label={`Object ${label(drawerId)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium ds-text">
              {label(drawerId)}{" "}
              <span className="font-mono text-xs ds-text-2">{labels.get(drawerId)?.typeKey ?? drawerId}</span>
            </p>
            <button type="button" onClick={() => setDrawerId(null)} className="underline ds-text-2">
              Close
            </button>
          </div>
          {drawerFacts === null ? (
            <p className="mt-1 ds-text-2">Loading facts…</p>
          ) : Object.keys(drawerFacts).length === 0 ? (
            <p className="mt-1 ds-text-2">No facts recorded.</p>
          ) : (
            <dl className="mt-1 grid grid-cols-2 gap-1">
              {Object.entries(drawerFacts).slice(0, 12).map(([k, v]) => (
                <div key={k} className="flex gap-1">
                  <dt className="ds-text-2">{k}:</dt>
                  <dd className="font-mono ds-text">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-2">
            <span className="ds-text-2">
              {graph.edges.filter((e) => e.fromId === drawerId || e.toId === drawerId).length} links in this view ·{" "}
            </span>
            <Link href={`/ontology/actions?object=${encodeURIComponent(drawerId)}`} className="underline ds-text">
              Actions
            </Link>{" "}
            ·{" "}
            <Link href={`/ontology/audit?objectId=${encodeURIComponent(drawerId)}`} className="underline ds-text">
              Audit
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function FacetChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded px-2 py-1 text-xs ds-state"
      style={
        active
          ? { background: "var(--accent)", color: "#141413", fontWeight: 500 }
          : { border: "1px solid var(--hairline)", color: "var(--fg-2)" }
      }
    >
      {label}
    </button>
  );
}

export default function Explorer() {
  return (
    <Suspense fallback={<p className="text-sm ds-text-2">Loading explorer…</p>}>
      <ExplorerInner />
    </Suspense>
  );
}
