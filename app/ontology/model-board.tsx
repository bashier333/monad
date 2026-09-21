"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph from "force-graph";

export interface BoardType {
  key: string;
  label: string;
  description: string;
  objectCount: number;
  properties: Array<{ key: string; kind: string; flags: string }>;
  actions: Array<{ key: string; label: string; approvalPolicy: string }>;
}

export interface BoardLink {
  key: string;
  from: string;
  to: string;
  cardinality: string;
}

interface BoardNode {
  id: string;
  label: string;
  count: number;
}

interface BoardEdge {
  source: string;
  target: string;
  label: string;
}

// Interactive map of the ontology itself: boxes are the kinds of things in
// your business (nouns), arrows are how they relate, and the detail panel
// lists what you or the AI may do with each kind (verbs). Click anything —
// this is the fastest way to learn how the whole model fits together.
export default function ModelBoard({
  types,
  links,
}: {
  types: BoardType[];
  links: BoardLink[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [themeVersion, setThemeVersion] = useState(0);

  const data = useMemo(() => {
    const nodes: BoardNode[] = types.map((t) => ({ id: t.key, label: t.label, count: t.objectCount }));
    const edges: BoardEdge[] = showLinks
      ? links
          .filter((l) => nodes.some((n) => n.id === l.from) && nodes.some((n) => n.id === l.to))
          .map((l) => ({ source: l.from, target: l.to, label: l.key }))
      : [];
    return { nodes, links: edges };
  }, [types, links, showLinks]);

  const selectedType = types.find((t) => t.key === selected) ?? null;

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeVersion((n) => n + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || data.nodes.length === 0) return;
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    const ground = v("--ground", "#f6f7f9");
    const fg = v("--fg", "#101828");
    const hairline = v("--hairline", "#e4e7ec");
    const accent = v("--accent", "#1570ef");
    const fg2 = v("--fg-2", "#475467");
    const selectedId = selected;
    const fgGraph = new ForceGraph<BoardNode & { x?: number; y?: number }, BoardEdge>(el)
      .graphData(data)
      .width(el.clientWidth)
      .height(420)
      .backgroundColor(ground)
      .nodeLabel((n) => {
        const t = types.find((x) => x.key === n.id);
        return `${n.label} — ${t?.objectCount ?? 0} objects`;
      })
      .nodeColor((n) => (n.id === selectedId ? accent : fg2))
      .nodeVal((n) => 4 + Math.min(10, n.count))
      .linkColor(() => hairline)
      .linkDirectionalArrowLength(5)
      .linkLabel((l) => l.label)
      .onNodeClick((n) => setSelected((s) => (s === n.id ? null : (n.id as string))))
      .onBackgroundClick(() => setSelected(null))
      .nodeCanvasObject((node, ctx, globalScale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const isSel = node.id === selectedId;
        const r = 4 + Math.min(10, (node as BoardNode).count);
        ctx.fillStyle = isSel ? accent : fg2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
        if (showLabels) {
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.strokeStyle = ground;
          ctx.lineWidth = 3 / globalScale;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.strokeText(node.label, x, y + r + 2);
          ctx.fillStyle = fg;
          ctx.fillText(node.label, x, y + r + 2);
        }
      });
    return () => {
      fgGraph._destructor();
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, themeVersion]);

  if (types.length === 0) {
    return (
      <div className="rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
        No types yet. Seed a pack (for example on the Twin page) and this board will draw your business here.
      </div>
    );
  }

  const incoming = (key: string) => links.filter((l) => l.to === key);
  const outgoing = (key: string) => links.filter((l) => l.from === key);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1 ds-text-2">
          <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} />
          Show relationships
        </label>
        <label className="flex items-center gap-1 ds-text-2">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          Show labels
        </label>
        <span className="ds-text-2">
          {types.length} kinds of things · {links.length} relationships ·{" "}
          {types.reduce((n, t) => n + t.actions.length, 0)} allowed actions
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded ds-panel md:col-span-3">
          <div
            ref={ref}
            className="h-[420px] w-full overflow-hidden"
            role="img"
            aria-label={`Model map of ${types.length} object types and ${links.length} links`}
          />
          <p className="px-3 pb-2 text-xs ds-text-2">Drag to pan, scroll to zoom, click a box for details.</p>
        </div>
        <div className="rounded ds-panel p-3 text-sm md:col-span-2" aria-live="polite">
          {selectedType ? (
            <div className="space-y-3">
              <div>
                <p className="font-medium ds-text">
                  {selectedType.label}{" "}
                  <span className="font-mono text-xs ds-text-2">
                    {selectedType.key} · {selectedType.objectCount} objects
                  </span>
                </p>
                {selectedType.description && <p className="mt-1 ds-text-2">{selectedType.description}</p>}
              </div>
              <div>
                <p className="font-medium ds-text">Fields ({selectedType.properties.length})</p>
                <ul className="mt-1 space-y-0.5">
                  {selectedType.properties.map((p) => (
                    <li key={p.key} className="font-mono text-xs">
                      <span className="ds-text">{p.key}</span>{" "}
                      <span className="ds-text-2">
                        {p.kind}
                        {p.flags ? ` · ${p.flags}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-medium ds-text">Relationships</p>
                {incoming(selectedType.key).length + outgoing(selectedType.key).length === 0 ? (
                  <p className="text-xs ds-text-2">None yet — an isolated box cannot be reasoned about. Add a link.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {outgoing(selectedType.key).map((l) => (
                      <li key={l.key} className="ds-text-2">
                        <span className="font-mono ds-text">{l.key}</span> → {l.to} ({l.cardinality})
                      </li>
                    ))}
                    {incoming(selectedType.key).map((l) => (
                      <li key={l.key} className="ds-text-2">
                        {l.from} → <span className="font-mono ds-text">{l.key}</span> ({l.cardinality})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="font-medium ds-text">Allowed actions ({selectedType.actions.length})</p>
                {selectedType.actions.length === 0 ? (
                  <p className="text-xs ds-text-2">Read-only: you can look, but nothing may change it.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {selectedType.actions.map((a) => (
                      <li key={a.key} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span>
                          <span className="ds-text">{a.label}</span>{" "}
                          <span className="ds-text-2">· {a.approvalPolicy} approval</span>
                        </span>
                        <Link href={`/ontology/actions?action=${encodeURIComponent(a.key)}`} className="underline ds-text">
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p>
                <Link href={`/ontology/${encodeURIComponent(selectedType.key)}`} className="text-xs underline ds-text">
                  Full type detail →
                </Link>
              </p>
            </div>
          ) : (
            <p className="ds-text-2">
              Click any box to see its fields, relationships, and what you or the AI are allowed to do with it.
              Bigger boxes hold more objects.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
