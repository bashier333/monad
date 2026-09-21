import { db } from "@/lib/core/db";
import { buildAdjacency, type Adjacency } from "@/lib/core/ontology/graph";
import { filterRows } from "@/lib/core/ontology/policies";
import { lotCoverage } from "@/lib/packs/manufacturing/logic/coverage";
import { reorderSuggestions, type LotLite } from "@/lib/packs/manufacturing/logic/reorder";
import { fulfillmentRisks, type ShipmentLite } from "@/lib/packs/manufacturing/logic/risk";
import { toRowPolicies } from "@/lib/packs/manufacturing/ontology";
import { seedManufacturingActions } from "@/lib/packs/manufacturing/actions";
import { seedManufacturingOntology } from "@/lib/packs/manufacturing/ontology";

export interface VisibleObject {
  id: string;
  key: string;
  typeKey: string;
  version: number;
  data: Record<string, unknown>;
}

export type Marking = "internal" | "confidential" | "restricted";

const MARKING_RANK: Record<string, number> = { internal: 0, confidential: 1, restricted: 2 };

export function rankOf(marking: unknown): number {
  return typeof marking === "string" && marking in MARKING_RANK ? MARKING_RANK[marking]! : 0;
}

// Membership role to maximum visible marking. Owners see everything;
// dispatchers see internal + confidential; viewers see internal only.
export function clearanceForRole(role: string): Marking {
  if (role === "OWNER") return "restricted";
  if (role === "DISPATCHER") return "confidential";
  return "internal";
}

// Fields whose values are replaced with [restricted] for readers below max
// clearance. Sensitivity is domain knowledge, so the registry lives here in
// the pack, not in core.
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  mfg_product: ["unit_value"],
};

export const RESTRICTED_TOKEN = "[restricted]";

export interface VisibilityOpts {
  clearance?: Marking;
}

// Pure visibility pass: drop rows above clearance, mask sensitive fields for
// readers below max clearance. Unknown/absent markings count as internal.
export function applyVisibility<T extends { data: Record<string, unknown>; typeKey: string }>(
  rows: T[],
  opts: VisibilityOpts = {}
): T[] {
  const clearance = opts.clearance ?? "restricted";
  const maxRank = rankOf(clearance);
  const out: T[] = [];
  for (const r of rows) {
    if (rankOf(r.data.marking) > maxRank) continue;
    if (maxRank >= rankOf("restricted")) {
      out.push(r);
      continue;
    }
    const sensitive = SENSITIVE_FIELDS[r.typeKey] ?? [];
    if (sensitive.length === 0) {
      out.push(r);
      continue;
    }
    const data = { ...r.data };
    for (const f of sensitive) {
      if (data[f] !== undefined && data[f] !== null) data[f] = RESTRICTED_TOKEN;
    }
    out.push({ ...r, data });
  }
  return out;
}

// Policy-enforced manufacturing read: deny by default. Only rows matching an
// active allow policy for the type are visible; the pack seed writes one
// allow-all policy per type so the twin is usable out of the box. Visibility
// options then apply marking clearance + field masking.
export async function visibleObjects(
  organizationId: string,
  typeKey: string,
  take = 200,
  opts: VisibilityOpts = {}
): Promise<VisibleObject[]> {
  const [policies, rows] = await Promise.all([
    db.ontoPolicy.findMany({
      where: { organizationId, typeKey, active: true },
      orderBy: { priority: "asc" },
    }),
    db.ontoObject.findMany({
      where: { organizationId, typeKey, deletedAt: null },
      orderBy: { key: "asc" },
      take: Math.min(Math.max(take, 1), 200),
    }),
  ]);
  const mapped = rows.map((r) => ({
    id: r.id,
    key: r.key,
    typeKey: r.typeKey,
    version: r.version,
    data: (r.data as Record<string, unknown>) ?? {},
  }));
  const allowed = filterRows(
    toRowPolicies(policies.map((p) => ({ effect: p.effect, field: p.field, op: p.op, value: p.value, priority: p.priority }))),
    mapped
  );
  return applyVisibility(allowed, opts);
}

export async function orgEdges(organizationId: string, take = 5000) {
  return db.ontoEdge.findMany({
    where: { organizationId },
    select: { fromId: true, linkKey: true, toId: true },
    take,
  });
}

export async function orgAdjacency(organizationId: string, take = 5000): Promise<Adjacency> {
  return buildAdjacency(await orgEdges(organizationId, take));
}

export interface TwinRisk {
  shipmentId: string;
  shipmentKey: string;
  qty: number;
  customers: string[];
  customerLabels: string[];
  plants: string[];
  plantLabels: string[];
}

export interface TwinCoverageRow {
  id: string;
  key: string;
  warehouse?: string;
  sku?: string;
  coverageDays: number | null;
  belowReorderPoint: boolean;
}

export interface TwinShipment {
  id: string;
  key: string;
  status: string;
  eta: string | null;
}

export interface TwinOverview {
  counts: Record<string, number>;
  coverage: TwinCoverageRow[];
  reorder: ReturnType<typeof reorderSuggestions>;
  risks: TwinRisk[];
  shipments: TwinShipment[];
  atRiskLots: number;
  delayedShipments: number;
}

export async function twinOverview(organizationId: string, opts: VisibilityOpts = {}): Promise<TwinOverview> {
  const [plants, warehouses, products, lots, shipments, customers, edges] = await Promise.all([
    visibleObjects(organizationId, "mfg_plant", 200, opts),
    visibleObjects(organizationId, "mfg_warehouse", 200, opts),
    visibleObjects(organizationId, "mfg_product", 200, opts),
    visibleObjects(organizationId, "mfg_inventory_lot", 200, opts),
    visibleObjects(organizationId, "mfg_shipment", 200, opts),
    visibleObjects(organizationId, "mfg_customer", 200, opts),
    orgEdges(organizationId),
  ]);
  const adjacency = buildAdjacency(edges);
  const lotLites: LotLite[] = lots.map((l) => ({
    id: l.id,
    key: l.key,
    data: {
      qty_on_hand: Number(l.data.qty_on_hand ?? 0),
      reorder_point: l.data.reorder_point === undefined || l.data.reorder_point === null ? null : Number(l.data.reorder_point),
      safety_stock: l.data.safety_stock === undefined || l.data.safety_stock === null ? null : Number(l.data.safety_stock),
      daily_demand: l.data.daily_demand === undefined || l.data.daily_demand === null ? null : Number(l.data.daily_demand),
    },
  }));
  const shipmentLites: ShipmentLite[] = shipments.map((s) => ({
    id: s.id,
    key: s.key,
    data: {
      status: String(s.data.status ?? ""),
      qty: s.data.qty === undefined || s.data.qty === null ? null : Number(s.data.qty),
      sla_hours: s.data.sla_hours === undefined || s.data.sla_hours === null ? null : Number(s.data.sla_hours),
    },
  }));
  const coverage = lotLites.map((l, i) => ({
    id: lots[i]!.id,
    key: l.key,
    warehouse: typeof lots[i]!.data.warehouse === "string" ? (lots[i]!.data.warehouse as string) : undefined,
    sku: typeof lots[i]!.data.sku === "string" ? (lots[i]!.data.sku as string) : undefined,
    ...lotCoverage(l.data),
  }));
  const suggestions = reorderSuggestions(lotLites, edges);
  const whIds = [...new Set(suggestions.map((s) => s.suggestedFromId).filter((id): id is string => id !== null))];
  const whRows =
    whIds.length === 0
      ? []
      : await db.ontoObject.findMany({
          where: { organizationId, id: { in: whIds }, deletedAt: null },
          select: { id: true, key: true },
        });
  const whKeys = new Map(whRows.map((w) => [w.id, w.key]));
  const reorder = suggestions.map((s) => ({
    ...s,
    suggestedFromKey: s.suggestedFromId ? (whKeys.get(s.suggestedFromId) ?? s.suggestedFromId) : null,
  }));
  const rawRisks = fulfillmentRisks(shipmentLites, adjacency);
  const labelIds = [...new Set([...rawRisks.flatMap((r) => r.customers), ...rawRisks.flatMap((r) => r.plants)])];
  const labelRows =
    labelIds.length === 0
      ? []
      : await db.ontoObject.findMany({
          where: { organizationId, id: { in: labelIds }, deletedAt: null },
          select: { id: true, key: true, data: true },
        });
  const labels = new Map(labelRows.map((r) => [r.id, String((r.data as Record<string, unknown>).name ?? r.key)]));
  const risks: TwinRisk[] = rawRisks.map((r) => ({
    ...r,
    customerLabels: r.customers.map((id) => labels.get(id) ?? id),
    plantLabels: r.plants.map((id) => labels.get(id) ?? id),
  }));
  return {
    counts: {
      plants: plants.length,
      warehouses: warehouses.length,
      products: products.length,
      lots: lots.length,
      shipments: shipments.length,
      customers: customers.length,
    },
    coverage,
    reorder,
    risks,
    shipments: shipments.map((s) => ({
      id: s.id,
      key: s.key,
      status: String(s.data.status ?? ""),
      eta: typeof s.data.eta === "string" ? s.data.eta : null,
    })),
    atRiskLots: coverage.filter((c) => c.belowReorderPoint).length,
    delayedShipments: shipmentLites.filter((s) => s.data.status === "delayed").length,
  };
}

export interface TwinGraphNode {
  id: string;
  key: string;
  type: string;
  label: string;
  region?: string;
  geopoint?: { lat: number; lng: number } | null;
  status?: string;
}

export interface TwinGraph {
  nodes: TwinGraphNode[];
  edges: Array<{ fromId: string; linkKey: string; toId: string }>;
}

function asGeopoint(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const lat = (v as Record<string, unknown>).lat;
  const lng = (v as Record<string, unknown>).lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// The plant/warehouse/customer network: policy-enforced nodes plus the
// supply-chain edges that connect them.
export async function twinGraph(organizationId: string): Promise<TwinGraph> {
  const [plants, warehouses, customers] = await Promise.all([
    visibleObjects(organizationId, "mfg_plant"),
    visibleObjects(organizationId, "mfg_warehouse"),
    visibleObjects(organizationId, "mfg_customer"),
  ]);
  const networkKeys = new Set(["mfg_supplies", "mfg_dest_customer", "mfg_dest_plant"]);
  const edges = await db.ontoEdge.findMany({
    where: { organizationId, linkKey: { in: [...networkKeys] } },
    select: { fromId: true, linkKey: true, toId: true },
    take: 5000,
  });
  const nodes: TwinGraph["nodes"] = [
    ...plants.map((p) => ({
      id: p.id,
      key: p.key,
      type: "plant",
      label: String(p.data.name ?? p.key),
      region: p.data.region === undefined ? undefined : String(p.data.region),
      geopoint: asGeopoint(p.data.geopoint),
      status: p.data.status === undefined ? undefined : String(p.data.status),
    })),
    ...warehouses.map((w) => ({
      id: w.id,
      key: w.key,
      type: "warehouse",
      label: String(w.data.name ?? w.key),
      region: w.data.region === undefined ? undefined : String(w.data.region),
      geopoint: asGeopoint(w.data.geopoint),
    })),
    ...customers.map((c) => ({ id: c.id, key: c.key, type: "customer", label: String(c.data.name ?? c.key), region: c.data.region === undefined ? undefined : String(c.data.region) })),
  ];
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.fromId) && ids.has(e.toId)) };
}

export async function seedManufacturingPack(organizationId: string, actorId: string) {
  const ontology = await seedManufacturingOntology(organizationId, actorId);
  const actions = await seedManufacturingActions(organizationId, actorId);
  return { ontology, actions };
}
