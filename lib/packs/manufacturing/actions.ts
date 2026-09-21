import { z } from "zod";
import { db } from "@/lib/core/db";
import { executeAction, requestApproval, resolveRef } from "@/lib/core/ontology/execute";
import { createEdgeInstance } from "@/lib/core/ontology/edges";
import { recordFact } from "@/lib/core/ontology/facts";
import { normalizeKey } from "@/lib/packs/manufacturing/adapters";

export const TRANSFER_QUORUM_THRESHOLD = 500;

export interface ManufacturingFieldSpec {
  name: string;
  type: "string" | "integer" | "number" | "enum" | "datetime" | "object";
  required: boolean;
  options?: string[];
  refType?: string;
  hint?: string;
}

export interface ManufacturingActionSpec {
  key: string;
  label: string;
  targetTypeKey: string;
  approvalPolicy: "none" | "single" | "quorum";
  requiredCount: number;
  description: string;
  inputs: Record<string, unknown>;
  fields: ManufacturingFieldSpec[];
  effects: Array<Record<string, unknown>>;
  // Governance: which membership roles may confirm this verb, and the agent
  // latitude tier. "never" verbs cannot be proposed or confirmed at all;
  // "auto" verbs are confirmable by any allowed role; "confirm" verbs follow
  // the approval policy on top of the role check.
  allowedRoles: string[];
  latitude: "auto" | "confirm" | "never";
}

export function canExecuteVerb(role: string, spec: Pick<ManufacturingActionSpec, "allowedRoles">): boolean {
  if (role === "OWNER") return true;
  return spec.allowedRoles.includes(role);
}

// Effects use $inputs.* references resolved at execution time by the engine,
// so one stored definition carries the whole mutation: set values, targeted
// sets on other objects, and created objects (create effect).
export const MANUFACTURING_ACTIONS: ManufacturingActionSpec[] = [
  {
    key: "mfg_transfer_stock",
    label: "Transfer stock",
    targetTypeKey: "mfg_inventory_lot",
    approvalPolicy: "single",
    requiredCount: 1,
    description: "Move qty from this lot to another lot. Transfers above 500 units need quorum approval.",
    inputs: {
      toLotId: "string (required)",
      qty: "integer > 0 (required)",
      sourceAfter: "computed: source qty minus transfer",
      targetAfter: "computed: destination qty plus transfer",
    },
    fields: [
      { name: "toLotId", type: "object", required: true, refType: "mfg_inventory_lot", hint: "Destination lot" },
      { name: "qty", type: "integer", required: true, hint: "Units to move" },
    ],
    effects: [
      { kind: "set", property: "qty_on_hand", value: "$inputs.sourceAfter" },
      { kind: "set", property: "qty_on_hand", value: "$inputs.targetAfter", targetId: "$inputs.toLotId" },
    ],
    allowedRoles: ["OWNER"],
    latitude: "confirm",
  },
  {
    key: "mfg_create_shipment",
    label: "Create shipment",
    targetTypeKey: "mfg_inventory_lot",
    approvalPolicy: "single",
    requiredCount: 1,
    description: "Create a planned shipment from this lot's inventory and decrement the lot.",
    inputs: {
      shipmentId: "string (required)",
      qty: "integer > 0 (required)",
      carrier: "string",
      eta: "datetime",
      slaHours: "number",
      destCustomerId: "string",
      destPlantId: "string",
      shipmentKey: "computed: normalized shipmentId",
      sourceAfter: "computed: origin qty minus shipment",
    },
    fields: [
      { name: "shipmentId", type: "string", required: true, hint: "Natural key, e.g. SH-2041" },
      { name: "qty", type: "integer", required: true, hint: "Units to ship" },
      { name: "carrier", type: "string", required: false },
      { name: "eta", type: "datetime", required: false },
      { name: "slaHours", type: "number", required: false },
      { name: "destCustomerId", type: "object", required: false, refType: "mfg_customer", hint: "Receiving customer" },
      { name: "destPlantId", type: "object", required: false, refType: "mfg_plant", hint: "Receiving plant" },
    ],
    effects: [
      {
        kind: "create",
        typeKey: "mfg_shipment",
        data: {
          key: "$inputs.shipmentKey",
          status: "planned",
          carrier: "$inputs.carrier",
          eta: "$inputs.eta",
          qty: "$inputs.qty",
          sla_hours: "$inputs.slaHours",
        },
      },
      { kind: "set", property: "qty_on_hand", value: "$inputs.sourceAfter" },
    ],
    allowedRoles: ["OWNER"],
    latitude: "confirm",
  },
  {
    key: "mfg_reroute_shipment",
    label: "Reroute shipment",
    targetTypeKey: "mfg_shipment",
    approvalPolicy: "single",
    requiredCount: 1,
    description: "Change a shipment's carrier, ETA, or planned status. Planner-only, single approval.",
    inputs: { carrier: "string", eta: "datetime", status: "planned|in_transit" },
    fields: [
      { name: "carrier", type: "string", required: false },
      { name: "eta", type: "datetime", required: false },
      { name: "status", type: "enum", required: false, options: ["planned", "in_transit"] },
    ],
    effects: [
      { kind: "set", property: "carrier", value: "$inputs.carrier" },
      { kind: "set", property: "eta", value: "$inputs.eta" },
      { kind: "set", property: "status", value: "$inputs.status" },
    ],
    allowedRoles: ["OWNER"],
    latitude: "confirm",
  },
  {
    key: "mfg_record_production",
    label: "Record production",
    targetTypeKey: "mfg_plant",
    approvalPolicy: "none",
    requiredCount: 1,
    description: "Set a plant's operating status and write a bitemporal production fact.",
    inputs: { status: "string (required)", producedQty: "integer" },
    fields: [
      { name: "status", type: "string", required: true, hint: "e.g. running, maintenance" },
      { name: "producedQty", type: "integer", required: false, hint: "Units produced, recorded as a fact" },
    ],
    effects: [{ kind: "set", property: "status", value: "$inputs.status" }],
    allowedRoles: ["OWNER", "DISPATCHER"],
    latitude: "auto",
  },
  {
    key: "mfg_resolve_delay",
    label: "Resolve delay",
    targetTypeKey: "mfg_shipment",
    approvalPolicy: "single",
    requiredCount: 1,
    description: "Move a delayed shipment to a resolved status and notify downstream viewers.",
    inputs: { status: "planned|in_transit|delivered (required)" },
    fields: [{ name: "status", type: "enum", required: true, options: ["planned", "in_transit", "delivered"] }],
    effects: [{ kind: "set", property: "status", value: "$inputs.status" }],
    allowedRoles: ["OWNER"],
    latitude: "confirm",
  },
  {
    key: "mfg_adjust_safety_stock",
    label: "Adjust safety stock",
    targetTypeKey: "mfg_inventory_lot",
    approvalPolicy: "none",
    requiredCount: 1,
    description: "Set a lot's safety stock and optional reorder point.",
    inputs: { safetyStock: "integer >= 0 (required)", reorderPoint: "integer >= 0" },
    fields: [
      { name: "safetyStock", type: "integer", required: true },
      { name: "reorderPoint", type: "integer", required: false },
    ],
    effects: [
      { kind: "set", property: "safety_stock", value: "$inputs.safetyStock" },
      { kind: "set", property: "reorder_point", value: "$inputs.reorderPoint" },
    ],
    allowedRoles: ["OWNER", "DISPATCHER"],
    latitude: "auto",
  },
];

const verbSchemas = {
  mfg_transfer_stock: z.object({ toLotId: z.string().min(1), qty: z.number().int().positive() }),
  mfg_create_shipment: z.object({
    shipmentId: z.string().min(1),
    qty: z.number().int().positive(),
    carrier: z.string().max(64).optional(),
    eta: z.string().max(40).optional(),
    slaHours: z.number().optional(),
    destCustomerId: z.string().optional(),
    destPlantId: z.string().optional(),
  }),
  mfg_reroute_shipment: z
    .object({
      carrier: z.string().max(64).optional(),
      eta: z.string().max(40).optional(),
      status: z.enum(["planned", "in_transit"]).optional(),
    })
    .refine((v) => v.carrier !== undefined || v.eta !== undefined || v.status !== undefined, {
      message: "at least one of carrier, eta, status is required",
    }),
  mfg_record_production: z.object({ status: z.string().min(1).max(32), producedQty: z.number().int().min(0).optional() }),
  mfg_resolve_delay: z.object({ status: z.enum(["planned", "in_transit", "delivered"]) }),
  mfg_adjust_safety_stock: z.object({ safetyStock: z.number().int().min(0), reorderPoint: z.number().int().min(0).optional() }),
} as const;

type VerbKey = keyof typeof verbSchemas;

export function validateVerbInputs(verb: string, raw: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const schema = verbSchemas[verb as VerbKey];
  if (!schema) return { ok: false, error: "unknown manufacturing action" };
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, value: parsed.data as Record<string, unknown> };
}

async function loadLot(organizationId: string, id: string) {
  return db.ontoObject.findFirst({ where: { id, organizationId, typeKey: "mfg_inventory_lot", deletedAt: null } });
}

async function computeInputs(
  organizationId: string,
  verb: string,
  objectId: string,
  inputs: Record<string, unknown>
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> {
  if (verb === "mfg_transfer_stock") {
    const source = await loadLot(organizationId, objectId);
    if (!source) return { ok: false, error: "source lot not found" };
    const target = await loadLot(organizationId, String(inputs.toLotId));
    if (!target) return { ok: false, error: "destination lot not found" };
    if (target.id === source.id) return { ok: false, error: "cannot transfer a lot to itself" };
    const qty = Number(inputs.qty);
    const sourceQty = Number((source.data as Record<string, unknown>).qty_on_hand ?? 0);
    const targetQty = Number((target.data as Record<string, unknown>).qty_on_hand ?? 0);
    if (qty > sourceQty) return { ok: false, error: `insufficient qty: lot holds ${sourceQty}, transfer needs ${qty}` };
    return {
      ok: true,
      value: {
        sourceAfter: sourceQty - qty,
        targetAfter: targetQty + qty,
        toLotId: target.id,
      },
    };
  }
  if (verb === "mfg_create_shipment") {
    const source = await loadLot(organizationId, objectId);
    if (!source) return { ok: false, error: "origin lot not found" };
    const qty = Number(inputs.qty);
    const sourceQty = Number((source.data as Record<string, unknown>).qty_on_hand ?? 0);
    if (qty > sourceQty) return { ok: false, error: `insufficient qty: lot holds ${sourceQty}, shipment needs ${qty}` };
    const shipmentKey = normalizeKey(String(inputs.shipmentId));
    if (!shipmentKey) return { ok: false, error: "shipmentId normalizes to an empty key" };
    return {
      ok: true,
      value: {
        sourceAfter: sourceQty - qty,
        shipmentKey,
        qty,
      },
    };
  }
  return { ok: true, value: {} };
}

export async function seedManufacturingActions(organizationId: string, actorId: string) {
  const results: Array<{ key: string; ok: boolean; error?: string }> = [];
  for (const spec of MANUFACTURING_ACTIONS) {
    const res = await executeActionDefine(organizationId, actorId, spec);
    results.push(res.ok ? { key: spec.key, ok: true } : { key: spec.key, ok: false, error: res.error ?? "unknown" });
  }
  return results;
}

async function executeActionDefine(
  organizationId: string,
  actorId: string,
  spec: ManufacturingActionSpec
): Promise<{ ok: boolean; error?: string }> {
  const { defineAction } = await import("@/lib/core/ontology/execute");
  const res = await defineAction(organizationId, {
    key: spec.key,
    label: spec.label,
    targetTypeKey: spec.targetTypeKey,
    inputs: { ...spec.inputs, fields: spec.fields, allowedRoles: spec.allowedRoles, latitude: spec.latitude },
    effects: spec.effects,
    approvalPolicy: spec.approvalPolicy,
    requiredCount: spec.requiredCount,
  });
  void actorId;
  return res.ok ? { ok: true } : { ok: false, error: "define failed" };
}

export interface ManufacturingActionPreview {
  ok: boolean;
  verb?: string;
  objectId?: string;
  objectKey?: string;
  inputs?: Record<string, unknown>;
  effects?: Array<Record<string, unknown>>;
  approvalRequired?: boolean;
  approvalPolicy?: string;
  allowedRoles?: string[];
  latitude?: string;
  error?: string;
}

// Dry-run used by the agent's action tool: validates and computes inputs and
// describes the effects without writing anything. Execution happens only
// through executeManufacturingAction after human confirmation.
export async function previewManufacturingAction(
  organizationId: string,
  verb: string,
  objectId: string,
  rawInputs: unknown
): Promise<ManufacturingActionPreview> {
  const spec = MANUFACTURING_ACTIONS.find((a) => a.key === verb);
  if (!spec) return { ok: false, error: "unknown manufacturing action" };
  if (spec.latitude === "never") return { ok: false, error: `${verb} is disabled by policy (latitude never)` };
  const validated = validateVerbInputs(verb, rawInputs);
  if (!validated.ok) return { ok: false, error: validated.error };
  const computed = await computeInputs(organizationId, verb, objectId, validated.value);
  if (!computed.ok) return { ok: false, error: computed.error };
  const inputs = { ...validated.value, ...computed.value };
  const needsQuorum =
    verb === "mfg_transfer_stock" && Number(inputs.qty) > TRANSFER_QUORUM_THRESHOLD;
  const obj = await db.ontoObject.findFirst({
    where: { id: objectId, organizationId, deletedAt: null },
    select: { key: true },
  });
  return {
    ok: true,
    verb,
    objectId,
    objectKey: obj?.key,
    inputs,
    effects: spec.effects,
    approvalRequired: spec.approvalPolicy !== "none" || needsQuorum,
    approvalPolicy: needsQuorum ? "quorum (large transfer)" : spec.approvalPolicy,
    allowedRoles: spec.allowedRoles,
    latitude: spec.latitude,
  };
}

export interface ManufacturingActionResult {
  ok: boolean;
  runId?: string;
  replayed?: boolean;
  createdIds?: string[];
  createErrors?: string[];
  approvalId?: string;
  error?: string;
  needsApproval?: boolean;
}

// Pre-commit validation + computed inputs -> governed engine execution
// (approval + idempotency + audit) -> post-commit side-effects (dest edges,
// bitemporal facts, downstream notifications).
export async function executeManufacturingAction(
  organizationId: string,
  actorId: string,
  verb: string,
  objectId: string,
  rawInputs: unknown,
  idempotencyKey: string,
  approvalId?: string,
  opts: { actorRole?: string } = {}
): Promise<ManufacturingActionResult> {
  const spec = MANUFACTURING_ACTIONS.find((a) => a.key === verb);
  if (!spec) return { ok: false, error: "unknown manufacturing action" };
  if (spec.latitude === "never") return { ok: false, error: `${verb} is disabled by policy (latitude never)` };
  if (opts.actorRole && !canExecuteVerb(opts.actorRole, spec)) {
    return { ok: false, error: `role ${opts.actorRole} may not confirm ${verb}` };
  }
  const validated = validateVerbInputs(verb, rawInputs);
  if (!validated.ok) return { ok: false, error: validated.error };
  const computed = await computeInputs(organizationId, verb, objectId, validated.value);
  if (!computed.ok) return { ok: false, error: computed.error };
  const inputs = { ...validated.value, ...computed.value };

  if (verb === "mfg_transfer_stock" && Number(inputs.qty) > TRANSFER_QUORUM_THRESHOLD) {
    if (!approvalId) {
      const req = await requestApproval(organizationId, actorId, {
        actionKey: verb,
        objectId,
        inputs: { ...validated.value, qty: Number(inputs.qty) },
        requiredCount: 2,
      });
      if (!req.ok) return { ok: false, error: req.error };
      return { ok: false, needsApproval: true, approvalId: req.value.id, error: "quorum approval required for large transfers" };
    }
    const approval = await db.ontoApproval.findFirst({ where: { id: approvalId, organizationId } });
    if (!approval || approval.requiredCount < 2) {
      return { ok: false, error: "large transfers require an approval with quorum (2)" };
    }
  }

  // Pre-commit webhooks: the owning external system can veto the write by
  // failing delivery. Skipped when no active webhook is configured.
  const { runPreCommitWebhooks } = await import("@/lib/core/ontology/webhooks");
  const gate = await runPreCommitWebhooks(organizationId, verb, objectId, actorId, inputs);
  if (!gate.ok) return { ok: false, error: gate.error };

  const res = await executeAction(organizationId, actorId, {
    actionKey: verb,
    objectId,
    inputs,
    idempotencyKey,
    approvalId,
  });
  if (!res.ok) {
    return {
      ok: false,
      error: res.error,
      needsApproval: "needsApproval" in res ? Boolean(res.needsApproval) : false,
    };
  }
  const run = res.value as { id: string; result: unknown };
  const result = (run.result as { createdIds?: string[]; createErrors?: string[] }) ?? {};

  if (!res.replayed) {
    const shipmentId = result.createdIds?.[0];
    if (verb === "mfg_create_shipment" && shipmentId) {
      const destCustomer = validated.value.destCustomerId;
      if (typeof destCustomer === "string" && destCustomer) {
        await createEdgeInstance(organizationId, shipmentId, "mfg_dest_customer", destCustomer);
      }
      const destPlant = validated.value.destPlantId;
      if (typeof destPlant === "string" && destPlant) {
        await createEdgeInstance(organizationId, shipmentId, "mfg_dest_plant", destPlant);
      }
      const originEdge = await createEdgeInstance(organizationId, shipmentId, "mfg_origin", objectId);
      void originEdge;
    }
    if (verb === "mfg_record_production" && validated.value.producedQty !== undefined) {
      await recordFact(organizationId, objectId, {
        property: "lastProductionQty",
        value: validated.value.producedQty,
        validFrom: new Date().toISOString(),
        reason: "recorded by mfg_record_production",
      });
    }
    if (verb === "mfg_resolve_delay") {
      const { notifyOrg } = await import("@/lib/core/notify");
      await notifyOrg(organizationId, "action", `Shipment ${objectId} resolved to ${String(validated.value.status)}`, "/ontology/twin");
    }
  }
  return {
    ok: true,
    runId: run.id,
    replayed: res.replayed,
    createdIds: result.createdIds ?? [],
    createErrors: result.createErrors ?? [],
  };
}

export function manufacturingVerbKeys(): string[] {
  return MANUFACTURING_ACTIONS.map((a) => a.key);
}

export function resolveVerbRef(value: unknown, inputs: Record<string, unknown>): unknown {
  return resolveRef(value, inputs).value;
}
