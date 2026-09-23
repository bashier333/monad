"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ForceGraph from "force-graph";
import { toGraphData, traceConnections, type GraphNode } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraph } from "@/lib/packs/manufacturing/service";

type PositionedNode = GraphNode & { x?: number; y?: number; fx?: number; fy?: number };
// force-graph mutates link endpoints from ids into node objects as it runs.
type PositionedLink = { source: string | PositionedNode; target: string | PositionedNode; label: string };

function linkEnds(l: PositionedLink): [string, string] {
  const s = typeof l.source === "string" ? l.source : l.source.id;
  const t = typeof l.target === "string" ? l.target : l.target.id;
  return [s, t];
}

// Canvas force-layout of the company network. Click a node to trace it:
// everything upstream (suppliers) and downstream (consumers) stays lit while
// the rest fades, so lineage reads at a glance. Drag any node to pin it
// where you want it; the layout works around your arrangement.
export default function NetworkGraph({ graph }: { graph: TwinGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const data = useMemo(() => toGraphData(graph.nodes, graph.edges), [graph]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? data.nodes.find((n) => n.id === selectedId) ?? null : null;
  const trace = useMemo(
    () => (selected ? traceConnections(data.links, selected.id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected?.id, data]
  );
  const lit = useMemo(() => {
    if (!selected || !trace) return null;
    return new Set([selected.id, ...trace.upstream, ...trace.downstream]);
  }, [selected, trace]);
  // The canvas accessors below must see the latest trace without rebuilding
  // the graph (a rebuild would reset the physics and drop dragged pins).
  const litRef = useRef(lit);
  litRef.current = lit;
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const fgRef = useRef<ForceGraph<PositionedNode, PositionedLink> | null>(null);

  // Nudge the canvas to repaint when the trace changes (a cooled-down
  // simulation stops ticking, so new highlights need a wake-up).
  useEffect(() => {
    fgRef.current?.resumeAnimation();
  }, [selectedId]);

  const [themeVersion, setThemeVersion] = useState(0);

  // Canvas ignores CSS: snapshot the computed tokens and rebuild the graph
  // when the theme flips so labels stay legible on both grounds.
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    return {
      ground: v("--ground", "#f6f7f9"),
      hairline: v("--hairline", "#e4e7ec"),
      fg: v("--fg", "#101828"),
      dim: v("--fg-2", "#667085"),
    };
  }

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeVersion((n) => n + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || data.nodes.length === 0) return;
    const t = themeColors();
    const fg = new ForceGraph<PositionedNode, PositionedLink>(el)
      .graphData(data)
      .width(el.clientWidth)
      .height(380)
      .backgroundColor(t.ground)
      .nodeLabel((n) => `${n.label} (${n.type})`)
      .nodeColor((n) => {
        const litNow = litRef.current;
        return litNow && !litNow.has(n.id) ? t.dim : n.color;
      })
      .linkColor((l) => {
        const litNow = litRef.current;
        if (!litNow) return t.hairline;
        const [s, tId] = linkEnds(l);
        return litNow.has(s) && litNow.has(tId) ? t.fg : t.hairline;
      })
      .linkWidth((l) => {
        const litNow = litRef.current;
        if (!litNow) return 1;
        const [s, tId] = linkEnds(l);
        return litNow.has(s) && litNow.has(tId) ? 2 : 1;
      })
      .linkDirectionalArrowLength(4)
      .linkLabel((l) => l.label)
      .onNodeClick((n) => {
        setSelectedId((prev) => (prev === n.id ? null : n.id));
      })
      .onBackgroundClick(() => setSelectedId(null))
      // Drag to arrange: dropping a node pins it there (fx/fy), so the
      // layout settles around the arrangement instead of resetting it.
      .onNodeDrag((node) => {
        node.fx = node.x;
        node.fy = node.y;
      })
      .onNodeDragEnd((node) => {
        node.fx = node.x;
        node.fy = node.y;
      })
      .nodeCanvasObject((node: PositionedNode, ctx, globalScale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const litNow = litRef.current;
        const dimmed = !!litNow && !litNow.has(node.id);
        ctx.globalAlpha = dimmed ? 0.25 : 1;
        ctx.fillStyle = dimmed ? t.dim : node.color;
        ctx.beginPath();
        ctx.arc(x, y, selectedRef.current === node.id ? 7 : 5, 0, 2 * Math.PI);
        ctx.fill();
        const fontSize = 11 / globalScale;
        ctx.font = `${fontSize}px sans-serif`;
        // Halo in the ground color keeps labels legible over links on dark.
        ctx.strokeStyle = t.ground;
        ctx.lineWidth = 3 / globalScale;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.strokeText(node.label, x, y + 7);
        ctx.fillStyle = dimmed ? t.dim : t.fg;
        ctx.fillText(node.label, x, y + 7);
        ctx.globalAlpha = 1;
      });
    fgRef.current = fg;
    return () => {
      fgRef.current = null;
      fg._destructor();
      el.innerHTML = "";
    };
  }, [data, router, themeVersion]);

  if (data.nodes.length === 0) {
    return (
      <div className="rounded ds-panel p-4">
        <p className="text-sm font-medium ds-text">Company network</p>
        <p className="mt-1 text-sm ds-text-2">No linked plants, warehouses, or customers yet. Seed the model and wire supply edges to see the graph.</p>
      </div>
    );
  }

  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">
        Company network ({data.nodes.length} nodes, {data.links.length} links)
      </p>
      <div ref={ref} className="h-[380px] w-full overflow-hidden" role="img" aria-label={`Force-directed graph of ${data.nodes.length} company network objects`} />
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
            Clear trace
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs ds-text-2">Click a node to trace what feeds it and what it feeds. Drag nodes to arrange the board.</p>
      )}
    </div>
  );
}
