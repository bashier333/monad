import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import type { TwinGraph, TwinGraphNode } from "@/lib/packs/manufacturing/service";

// Operations-board adapters. Manufacturing already speaks TwinGraph; freight
// and agency answer in weekly margins, so this layer derives the same visual
// shapes from them WITHOUT new tables or migrations:
// - freight lanes become origin -> destination graph edges
// - agency projects become client -> project -> person graph edges
// - places are geo-pinned from a static city map (seed-alias cities first)

export interface BoardLane {
  lane: string;
  origin: string;
  destination: string;
  loads: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
}

export interface BoardProject {
  project: string;
  client: string;
  revisions: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  budgetVsActual: number | null;
}

export interface FreightBoard {
  totals: { revenue: number; cost: number; margin: number; loads: number };
  costByKind: Record<string, number>;
  worst: BoardLane[];
  best: BoardLane[];
  graph: TwinGraph;
  geoCount: number;
  weekStart: string;
}

export interface AgencyBoard {
  totals: { revenue: number; cost: number; margin: number; revisions: number };
  costByKind: Record<string, number>;
  worst: BoardProject[];
  best: BoardProject[];
  graph: TwinGraph;
  weekStart: string;
}

// Static city pins. Keys must match normalized place names ("DALLAS TX").
// Covers the seed-alias cities first; unknown places simply skip the map
// (the lane table and bars still show them — nothing silently drops).
const CITY_GEO: Record<string, { lat: number; lng: number }> = {
  "DALLAS TX": { lat: 32.7767, lng: -96.797 },
  "FORT WORTH TX": { lat: 32.7555, lng: -97.3308 },
  "HOUSTON TX": { lat: 29.7604, lng: -95.3698 },
  "SAN ANTONIO TX": { lat: 29.4241, lng: -98.4936 },
  "AUSTIN TX": { lat: 30.2672, lng: -97.7431 },
  "EL PASO TX": { lat: 31.7619, lng: -106.485 },
  "ATLANTA GA": { lat: 33.749, lng: -84.388 },
  "CHICAGO IL": { lat: 41.8781, lng: -87.6298 },
  "LOS ANGELES CA": { lat: 34.0522, lng: -118.2437 },
  "MEMPHIS TN": { lat: 35.1495, lng: -90.049 },
};

export function geoForPlace(place: string): { lat: number; lng: number } | null {
  return CITY_GEO[place.trim().toUpperCase()] ?? null;
}

function placeNode(place: string): TwinGraphNode {
  const key = place.trim().toUpperCase();
  return {
    id: `freight:place:${key}`,
    key,
    type: "place",
    label: place,
    geopoint: geoForPlace(place),
  };
}

export async function freightBoard(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string
): Promise<FreightBoard | null> {
  let answer;
  try {
    answer = await getWeeklyAnswer(organizationId, weekStartsOn, anchorISO);
  } catch {
    return null;
  }
  const byMargin = [...answer.lanes].sort((a, b) => a.margin - b.margin);
  const nodes = new Map<string, TwinGraphNode>();
  const edges: TwinGraph["edges"] = [];
  let geoCount = 0;
  for (const l of answer.lanes) {
    for (const p of [l.origin, l.destination]) {
      const n = placeNode(p);
      if (!nodes.has(n.id)) {
        nodes.set(n.id, n);
        if (n.geopoint) geoCount += 1;
      }
    }
    edges.push({
      fromId: `freight:place:${l.origin.trim().toUpperCase()}`,
      linkKey: "lane",
      toId: `freight:place:${l.destination.trim().toUpperCase()}`,
    });
  }
  const lane = (l: (typeof answer.lanes)[number]): BoardLane => ({
    lane: l.lane,
    origin: l.origin,
    destination: l.destination,
    loads: l.loads,
    revenue: l.revenue,
    cost: l.cost,
    margin: l.margin,
    marginPct: l.marginPct,
  });
  return {
    totals: {
      revenue: answer.totals.revenue,
      cost: answer.totals.cost,
      margin: answer.totals.margin,
      loads: answer.totals.loads,
    },
    costByKind: answer.lanes.reduce<Record<string, number>>((acc, l) => {
      for (const [k, v] of Object.entries(l.costByKind)) acc[k] = (acc[k] ?? 0) + (v ?? 0);
      return acc;
    }, {}),
    worst: byMargin.slice(0, 5).map(lane),
    best: byMargin.slice(-5).reverse().map(lane),
    graph: { nodes: [...nodes.values()], edges },
    geoCount,
    weekStart: answer.meta.weekStart,
  };
}

export async function agencyBoard(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string
): Promise<AgencyBoard | null> {
  let answer;
  try {
    answer = await getAgencyAnswer(organizationId, weekStartsOn, anchorISO);
  } catch {
    return null;
  }
  const byMargin = [...answer.projects].sort((a, b) => a.margin - b.margin);
  const nodes = new Map<string, TwinGraphNode>();
  const edges: TwinGraph["edges"] = [];
  const put = (n: TwinGraphNode) => {
    if (!nodes.has(n.id)) nodes.set(n.id, n);
  };
  for (const p of answer.projects) {
    const client = `agency:client:${p.client.trim().toUpperCase()}`;
    const project = `agency:project:${p.project.trim().toUpperCase()}`;
    put({ id: client, key: p.client, type: "client", label: p.client });
    put({ id: project, key: p.project, type: "project", label: p.project });
    edges.push({ fromId: client, linkKey: "briefs", toId: project });
  }
  const proj = (p: (typeof answer.projects)[number]): BoardProject => ({
    project: p.project,
    client: p.client,
    revisions: p.revisions,
    revenue: p.revenue,
    cost: p.cost,
    margin: p.margin,
    marginPct: p.marginPct,
    budgetVsActual: p.budgetVsActual,
  });
  return {
    totals: {
      revenue: answer.totals.revenue,
      cost: answer.totals.cost,
      margin: answer.totals.margin,
      revisions: answer.totals.revisions,
    },
    costByKind: answer.projects.reduce<Record<string, number>>((acc, p) => {
      for (const [k, v] of Object.entries(p.costByKind)) acc[k] = (acc[k] ?? 0) + (v ?? 0);
      return acc;
    }, {}),
    worst: byMargin.slice(0, 5).map(proj),
    best: byMargin.slice(-5).reverse().map(proj),
    graph: { nodes: [...nodes.values()], edges },
    weekStart: answer.meta.weekStart,
  };
}
