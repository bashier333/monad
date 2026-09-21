import type { TwinGraphNode } from "@/lib/packs/manufacturing/service";

export const TYPE_COLORS: Record<string, string> = {
  plant: "#047857",
  warehouse: "#1d4ed8",
  customer: "#b45309",
  shipment: "#6d28d9",
  lot: "#64748b",
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
