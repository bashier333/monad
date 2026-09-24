"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { layoutFlow, traceConnections, type GraphLink } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraph } from "@/lib/packs/manufacturing/service";
import { FLOW_NODE_H, FLOW_NODE_W } from "@/lib/packs/manufacturing/graph-view";

// The company as a left-to-right workflow: suppliers make, plants build,
// warehouses hold, customers receive. Stages come from the edges themselves,
// so any data renders with no configuration. Click a step to trace its full
// lineage through the funnel; the side card opens the object itself.
export default function FlowBoard({ graph }: { graph: TwinGraph }) {
  const router = useRouter();
  const laid = useMemo(() => layoutFlow(graph.nodes, graph.edges), [graph]);
  const links: GraphLink[] = useMemo(
    () => laid.edges.flatMap((e) => e.labels.map((label) => ({ source: e.source, target: e.target, label }))),
    [laid]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? (laid.nodes.find((n) => n.id === selectedId) ?? null) : null;
  const trace = useMemo(() => (selected ? traceConnections(links, selected.id) : null), [selected, links]);
  const lit = useMemo(() => {
    if (!selected || !trace) return null;
    return new Set([selected.id, ...trace.upstream, ...trace.downstream]);
  }, [selected, trace]);

  if (laid.nodes.length === 0) {
    return (
      <div className="rounded ds-panel p-4">
        <p className="text-sm font-medium ds-text">Company workflow</p>
        <p className="mt-1 text-sm ds-text-2">Nothing flows yet. Connect data and each step lands here in order.</p>
      </div>
    );
  }

  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">
        Company workflow ({laid.nodes.length} steps, {laid.edges.length} flows)
      </p>
      <div className="overflow-x-auto" role="img" aria-label={`Workflow of ${laid.nodes.length} steps in order`}>
        <svg width={laid.width} height={laid.height} className="block min-w-full">
          {laid.edges.map((e, i) => {
            const on = !lit || (lit.has(e.source) && lit.has(e.target));
            return (
              <path
                key={`${e.source}-${e.target}-${i}`}
                d={e.d}
                fill="none"
                stroke={on ? "var(--accent)" : "var(--hairline)"}
                strokeWidth={on ? e.width : 1}
                opacity={lit && !on ? 0.15 : 0.85}
              >
                <title>{e.labels.join(", ")}</title>
              </path>
            );
          })}
          {laid.nodes.map((n) => {
            const dim = !!lit && !lit.has(n.id);
            const isSel = selectedId === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedId((prev) => (prev === n.id ? null : n.id))}
                style={{ cursor: "pointer" }}
                opacity={dim ? 0.25 : 1}
              >
                <title>{`${n.label} (${n.type})`}</title>
                <rect
                  width={FLOW_NODE_W}
                  height={FLOW_NODE_H}
                  rx={8}
                  fill="var(--panel)"
                  stroke={isSel ? "var(--accent)" : "var(--hairline)"}
                  strokeWidth={isSel ? 2 : 1}
                />
                <rect width={4} height={FLOW_NODE_H} rx={2} fill={n.color} />
                <text x={12} y={19} fontSize={12} fontWeight={600} fill="var(--fg)">
                  {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                </text>
                <text x={12} y={34} fontSize={10} fill="var(--fg-2)">
                  {n.type}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {selected && trace ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm" style={{ borderColor: "var(--hairline)" }}>
          <p className="min-w-0 flex-1 ds-text">
            <span className="font-medium">{selected.label}</span>{" "}
            <span className="ds-text-2">
              · {trace.upstream.length} upstream · {trace.downstream.length} downstream
            </span>
          </p>
          <button
            type="button"
            onClick={() => router.push(`/ontology/explore?id=${encodeURIComponent(selected.id)}`)}
            className="rounded border px-2 py-1 text-[13px] ds-text"
            style={{ borderColor: "var(--hairline)" }}
          >
            Open details
          </button>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded border px-2 py-1 text-[13px] ds-text-2"
            style={{ borderColor: "var(--hairline)" }}
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs ds-text-2">Click any step to trace what feeds it and what it feeds.</p>
      )}
    </div>
  );
}
