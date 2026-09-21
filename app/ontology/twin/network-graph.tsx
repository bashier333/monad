"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ForceGraph from "force-graph";
import { toGraphData, type GraphLink, type GraphNode } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraph } from "@/lib/packs/manufacturing/service";

type PositionedNode = GraphNode;

// Canvas force-layout of the supply network. Nodes are colored by type,
// click-through opens the object in the explorer. The text list below stays
// as the accessible, no-JS fallback.
export default function NetworkGraph({ graph }: { graph: TwinGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const data = useMemo(() => toGraphData(graph.nodes, graph.edges), [graph]);

  const [themeVersion, setThemeVersion] = useState(0);

  // Canvas ignores CSS: snapshot the computed tokens and rebuild the graph
  // when the theme flips so labels stay legible on both grounds.
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    return { ground: v("--ground", "#faf9f5"), hairline: v("--hairline", "#dedcd1"), fg: v("--fg", "#141413") };
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
    const fg = new ForceGraph<PositionedNode, GraphLink>(el)
      .graphData(data)
      .width(el.clientWidth)
      .height(380)
      .backgroundColor(t.ground)
      .nodeLabel((n) => `${n.label} (${n.type})`)
      .nodeColor((n) => n.color)
      .linkColor(() => t.hairline)
      .linkDirectionalArrowLength(4)
      .linkLabel((l) => l.label)
      .onNodeClick((n) => {
        router.push(`/ontology/explore?id=${encodeURIComponent(n.id)}`);
      })
      .nodeCanvasObject((node: PositionedNode & { x?: number; y?: number }, ctx, globalScale) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        const fontSize = 11 / globalScale;
        ctx.font = `${fontSize}px sans-serif`;
        // Halo in the ground color keeps labels legible over links on dark.
        ctx.strokeStyle = t.ground;
        ctx.lineWidth = 3 / globalScale;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.strokeText(node.label, x, y + 7);
        ctx.fillStyle = t.fg;
        ctx.fillText(node.label, x, y + 7);
      });
    return () => {
      fg._destructor();
      el.innerHTML = "";
    };
  }, [data, router, themeVersion]);

  if (data.nodes.length === 0) {
    return (
      <div className="rounded ds-panel p-4">
        <p className="text-sm font-medium ds-text">Supply network</p>
        <p className="mt-1 text-sm ds-text-2">No linked plants, warehouses, or customers yet. Seed the model and wire supply edges to see the graph.</p>
      </div>
    );
  }

  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">
        Supply network ({data.nodes.length} nodes, {data.links.length} links)
      </p>
      <div ref={ref} className="h-[380px] w-full overflow-hidden" role="img" aria-label={`Force-directed graph of ${data.nodes.length} supply network objects`} />
      <p className="mt-1 text-xs ds-text-2">Drag to pan, scroll to zoom, click a node to open it.</p>
    </div>
  );
}
