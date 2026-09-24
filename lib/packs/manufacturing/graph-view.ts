import type { TwinGraphNode } from "@/lib/packs/manufacturing/service";

export const TYPE_COLORS: Record<string, string> = {
  plant: "#047857",
  warehouse: "#1d4ed8",
  customer: "#b45309",
  shipment: "#6d28d9",
  lot: "#64748b",
  // Operations-board packs share the same canvas. Freight places and agency
  // clients/projects reuse this map so every pack renders without new code.
  place: "#0e7490",
  client: "#b45309",
  project: "#1d4ed8",
};

export function colorForType(type: string): string {
  return TYPE_COLORS[type] ?? "#57534e";
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color: string;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

// Pure mapping from the twin network to force-graph data. Deduplicates
// nodes, drops edges that point outside the node set.
export function toGraphData(
  nodes: TwinGraphNode[],
  edges: Array<{ fromId: string; linkKey: string; toId: string }>
): { nodes: GraphNode[]; links: GraphLink[] } {
  const seen = new Set<string>();
  const out: GraphNode[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push({ id: n.id, label: n.label, type: n.type, color: colorForType(n.type) });
  }
  const links: GraphLink[] = [];
  for (const e of edges) {
    if (!seen.has(e.fromId) || !seen.has(e.toId)) continue;
    links.push({ source: e.fromId, target: e.toId, label: e.linkKey });
  }
  return { nodes: out, links };
}

// Connection tracing: everything upstream of a node (following links
// backwards to its suppliers) and everything downstream (following links
// forward to its consumers). Powers click-to-trace on the board — the moment
// a company sees one shipment's full lineage, the board clicks.
export function traceConnections(
  links: GraphLink[],
  startId: string
): { upstream: string[]; downstream: string[] } {
  const into = new Map<string, string[]>();
  const outOf = new Map<string, string[]>();
  for (const l of links) {
    if (!outOf.has(l.source)) outOf.set(l.source, []);
    outOf.get(l.source)!.push(l.target);
    if (!into.has(l.target)) into.set(l.target, []);
    into.get(l.target)!.push(l.source);
  }
  const walk = (adj: Map<string, string[]>) => {
    const seen = new Set<string>([startId]);
    const queue = [...(adj.get(startId) ?? [])];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(...(adj.get(id) ?? []));
    }
    seen.delete(startId);
    return [...seen].sort();
  };
  return { upstream: walk(into), downstream: walk(outOf) };
}

export interface FlowNode {
  id: string;
  label: string;
  type: string;
  color: string;
  stage: number;
  x: number;
  y: number;
}

export interface FlowEdge {
  source: string;
  target: string;
  labels: string[];
  width: number;
  d: string;
}

export const FLOW_NODE_W = 150;
export const FLOW_NODE_H = 44;
const FLOW_GAP_X = 90;
const FLOW_GAP_Y = 14;
const FLOW_PAD = 16;

// Funnel layout: every company is a left-to-right flow (suppliers make,
// plants build, warehouses hold, customers receive). Stages come from the
// edges themselves via longest-path layering, so any pack renders without
// configuration. Cycle-safe: nodes stuck in a loop land in the last stage.
// Pure: same input, same positions, no physics, no randomness.
export function layoutFlow(
  nodes: TwinGraphNode[],
  edges: Array<{ fromId: string; linkKey: string; toId: string }>
): { nodes: FlowNode[]; edges: FlowEdge[]; width: number; height: number } {
  const { nodes: flat, links } = toGraphData(nodes, edges);
  const ids = new Set(flat.map((n) => n.id));
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const l of links) {
    if (!outgoing.has(l.source)) outgoing.set(l.source, []);
    outgoing.get(l.source)!.push(l.target);
    if (!incoming.has(l.target)) incoming.set(l.target, []);
    incoming.get(l.target)!.push(l.source);
  }
  // Longest-path layering, bounded: each pass assigns nodes whose
  // predecessors all have stages; leftovers (cycles) go last.
  const stage = new Map<string, number>();
  let changed = true;
  for (let pass = 0; pass < ids.size + 1 && changed; pass++) {
    changed = false;
    for (const n of flat) {
      if (stage.has(n.id)) continue;
      const preds = incoming.get(n.id) ?? [];
      if (preds.every((p) => stage.has(p))) {
        stage.set(n.id, preds.length === 0 ? 0 : Math.max(...preds.map((p) => stage.get(p)!)) + 1);
        changed = true;
      }
    }
  }
  const maxStage = Math.max(0, ...[...stage.values()]);
  for (const n of flat) if (!stage.has(n.id)) stage.set(n.id, maxStage + 1);
  const finalMax = Math.max(0, ...[...stage.values()]);

  const byStage = new Map<number, typeof flat>();
  for (const n of flat) {
    const s = stage.get(n.id)!;
    if (!byStage.has(s)) byStage.set(s, []);
    byStage.get(s)!.push(n);
  }
  for (const list of byStage.values()) list.sort((a, b) => a.label.localeCompare(b.label));

  const pos = new Map<string, { x: number; y: number }>();
  const out: FlowNode[] = [];
  for (let s = 0; s <= finalMax; s++) {
    const list = byStage.get(s) ?? [];
    list.forEach((n, i) => {
      const x = FLOW_PAD + s * (FLOW_NODE_W + FLOW_GAP_X);
      const y = FLOW_PAD + i * (FLOW_NODE_H + FLOW_GAP_Y);
      pos.set(n.id, { x, y });
      out.push({ ...n, stage: s, x, y });
    });
  }
  const height = FLOW_PAD * 2 + Math.max(1, ...[...byStage.values()].map((l) => l.length)) * (FLOW_NODE_H + FLOW_GAP_Y);
  const width = FLOW_PAD * 2 + (finalMax + 1) * FLOW_NODE_W + finalMax * FLOW_GAP_X;

  // Merge parallel edges: one path per pair, thicker with volume.
  const grouped = new Map<string, { source: string; target: string; labels: string[] }>();
  for (const l of links) {
    const k = `${l.source}→${l.target}`;
    if (!grouped.has(k)) grouped.set(k, { source: l.source, target: l.target, labels: [] });
    grouped.get(k)!.labels.push(l.label);
  }
  const flowEdges: FlowEdge[] = [];
  for (const g of grouped.values()) {
    const a = pos.get(g.source);
    const b = pos.get(g.target);
    if (!a || !b) continue;
    const x1 = a.x + FLOW_NODE_W;
    const y1 = a.y + FLOW_NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + FLOW_NODE_H / 2;
    const mx = x1 + (x2 - x1) / 2;
    flowEdges.push({
      source: g.source,
      target: g.target,
      labels: [...new Set(g.labels)],
      width: Math.min(1 + 0.9 * (g.labels.length - 1), 6),
      d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
    });
  }
  return { nodes: out, edges: flowEdges, width, height };
}

export interface MapPoint {
  id: string;
  label: string;
  type: string;
  lat: number;
  lng: number;
  status?: string;
}

// Pure mapping from twin nodes to mappable points. Nodes without valid
// coordinates are dropped (callers render a fallback note with the count).
export function toMapPoints(nodes: TwinGraphNode[]): { points: MapPoint[]; skipped: number } {
  const points: MapPoint[] = [];
  let skipped = 0;
  for (const n of nodes) {
    const g = n.geopoint;
    if (
      !g ||
      !Number.isFinite(g.lat) ||
      !Number.isFinite(g.lng) ||
      g.lat < -90 ||
      g.lat > 90 ||
      g.lng < -180 ||
      g.lng > 180
    ) {
      skipped += 1;
      continue;
    }
    points.push({ id: n.id, label: n.label, type: n.type, lat: g.lat, lng: g.lng, status: n.status });
  }
  return { points, skipped };
}
