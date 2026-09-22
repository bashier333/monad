import { traverseLive } from "@/lib/core/ontology/edges";
import { TOOL_SCHEMAS, type ToolExecutors, type ToolReport } from "@/lib/core/agent/tools";
import type { AgentContext } from "@/lib/core/agent/context";
import { policyAwareReadType } from "@/lib/packs/agent";
import { orgAdjacency, orgEdges } from "@/lib/packs/manufacturing/service";
import { coverageDays } from "@/lib/packs/manufacturing/logic/coverage";
import { reorderSuggestions } from "@/lib/packs/manufacturing/logic/reorder";
import { fulfillmentRisks } from "@/lib/packs/manufacturing/logic/risk";
import { demandForecast } from "@/lib/packs/manufacturing/logic/forecast";
import { previewManufacturingAction } from "@/lib/packs/manufacturing/actions";
import { executeStoredFunction } from "@/lib/core/ontology/functions-store";
import { allNativeHandlers } from "@/lib/packs/function-handlers";

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function queryExecutor(organizationId: string, actorId: string, ctx: AgentContext, input: unknown): Promise<ToolReport> {
  void actorId;
  const parsed = TOOL_SCHEMAS.ontology_query.safeParse(input ?? {});
  if (!parsed.success) return { summary: "query needs op=list with type, or op=traverse with id", citedIds: [], result: null };
  const { op, type, id, depth } = parsed.data;
  if (op === "traverse") {
    if (!id) return { summary: "traverse needs id", citedIds: [], result: null };
    const res = await traverseLive(organizationId, id, { maxDepth: depth ?? 2, direction: "both" });
    if (!res.ok) return { summary: `traverse failed: ${res.error}`, citedIds: [], result: null };
    const cited = [id, ...res.value.nodes];
    return {
      summary: `traversed ${res.value.nodes.length} objects, ${res.value.edges.length} edges from ${id}`,
      citedIds: cited,
      result: { nodes: res.value.nodes, edges: res.value.edges.map((e) => ({ from: e.fromId, link: e.linkKey, to: e.toId })) },
    };
  }
  if (!type) return { summary: "list needs type", citedIds: [], result: null };
  const rows = await policyAwareReadType(organizationId, type, 50);
  void ctx;
  return {
    summary: `${rows.length} ${type} objects`,
    citedIds: rows.map((r) => r.id),
    result: rows.map((r) => ({ id: r.id, key: r.key, data: r.data })),
  };
}

async function logicExecutor(organizationId: string, actorId: string, ctx: AgentContext, input: unknown): Promise<ToolReport> {
  void actorId;
  const parsed = TOOL_SCHEMAS.ontology_logic.safeParse(input ?? {});
  if (!parsed.success) return { summary: "logic needs fn and args", citedIds: [], result: null };
  const { fn, args } = parsed.data;
  if (fn === "coverage_days") {
    const qty = num((args as Record<string, unknown>).qtyOnHand ?? 0) ?? 0;
    const demand = num((args as Record<string, unknown>).dailyDemand);
    const days = coverageDays(qty, demand ?? 0);
    return { summary: `coverage ${days === null ? "unknown" : `${days} days`}`, citedIds: [], result: { coverageDays: days } };
  }
  if (fn === "reorder_suggestion") {
    const lots = ctx.nodes
      .filter((n) => n.type === "mfg_inventory_lot")
      .map((n) => ({
        id: n.id,
        key: n.key,
        data: {
          qty_on_hand: num(n.data.qty_on_hand) ?? 0,
          reorder_point: num(n.data.reorder_point),
          safety_stock: num(n.data.safety_stock),
          daily_demand: num(n.data.daily_demand),
        },
      }));
    const suggestions = reorderSuggestions(lots, await orgEdges(organizationId));
    return {
      summary: `${suggestions.length} reorder suggestions`,
      citedIds: suggestions.map((s) => s.lotId),
      result: suggestions,
    };
  }
  if (fn === "fulfillment_risk") {
    const shipments = ctx.nodes
      .filter((n) => n.type === "mfg_shipment")
      .map((n) => ({
        id: n.id,
        key: n.key,
        data: { status: String(n.data.status ?? ""), qty: num(n.data.qty), sla_hours: num(n.data.sla_hours) },
      }));
    const risks = fulfillmentRisks(shipments, await orgAdjacency(organizationId));
    return {
      summary: `${risks.length} at-risk shipments`,
      citedIds: risks.map((r) => r.shipmentId),
      result: risks,
    };
  }
  const history = (args as { history?: Array<{ weekStart?: string; demand?: unknown }> }).history ?? [];
  const points = history
    .filter((h) => typeof h.weekStart === "string" && num(h.demand) !== null)
    .map((h) => ({ weekStart: h.weekStart!, demand: num(h.demand)! }));
  if (fn === "demand_forecast") {
    const forecast = demandForecast(points);
    if (!forecast) return { summary: "demand forecast needs at least two weeks of history", citedIds: [], result: null };
    return { summary: `demand forecast ${forecast.point} (slope ${forecast.slope})`, citedIds: [], result: forecast };
  }
  // Registry fallback: any other fn resolves through the org's function
  // registry (formula/aggregation/composite execute in-process; native runs
  // the pack handler). Unknown keys error exactly like before.
  try {
    const res = await executeStoredFunction(organizationId, fn, (args ?? {}) as Record<string, unknown>, {
      nativeHandlers: allNativeHandlers,
    });
    if (!res.ok) return { summary: `logic rejected: ${res.error}`, citedIds: [], result: null };
    return { summary: `registry function ${fn} ok`, citedIds: [], result: res.value };
  } catch {
    return { summary: `logic rejected: unknown function ${fn}`, citedIds: [], result: null };
  }
}

async function actionExecutor(organizationId: string, actorId: string, ctx: AgentContext, input: unknown): Promise<ToolReport> {
  void actorId;
  const parsed = TOOL_SCHEMAS.ontology_action.safeParse(input ?? {});
  if (!parsed.success) return { summary: "action needs verb, objectId, and inputs", citedIds: [], result: null };
  const { verb, objectId, inputs } = parsed.data;
  const preview = await previewManufacturingAction(organizationId, verb, objectId, inputs);
  if (!preview.ok) return { summary: `action rejected: ${preview.error}`, citedIds: [], result: null };
  const citedIds = [objectId, ...Object.values(inputs).filter((v): v is string => typeof v === "string" && ctx.nodes.some((n) => n.id === v))];
  // Proposals never execute: the agent describes, the human confirms through
  // /api/agent/confirm, and the engine audits the write-back.
  return {
    summary: `proposed ${verb} on ${objectId} (approval: ${preview.approvalPolicy})`,
    citedIds,
    result: { proposal: preview },
  };
}

// Every tool record carries the actor it ran for. Executors themselves stay
// side-effect-free (query/logic/preview only); enforcement lives at preview
// (latitude tiers), confirm (per-verb roles), and audit (actorId on events).
function withActor(ex: ToolExecutors[keyof ToolExecutors]): ToolExecutors[keyof ToolExecutors] {
  return async (organizationId, actorId, ctx, input) => {
    const report = await ex(organizationId, actorId, ctx, input);
    return { ...report, actorId };
  };
}

export const manufacturingToolExecutors: ToolExecutors = {
  ontology_query: withActor(queryExecutor),
  ontology_logic: withActor(logicExecutor),
  ontology_action: withActor(actionExecutor),
};
