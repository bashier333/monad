import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { applySetEffects, dryRunSet, quorumReached, type ActionEffect } from "@/lib/core/ontology/actions";
import { createEdgeInstance } from "@/lib/core/ontology/edges";
import { recordEvent } from "@/lib/core/ontology/facts";
import { runPreCommitWebhooks } from "@/lib/core/ontology/webhooks";
import { createObject, naturalKeyFor } from "@/lib/core/ontology/objects";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function resolveRef(value: unknown, inputs: Record<string, unknown> | undefined): { ok: boolean; value: unknown } {  if (typeof value === "string" && value.startsWith("$inputs.")) {
    const key = value.slice("$inputs.".length);
    if (!inputs || !(key in inputs)) return { ok: false, value: null };
    return { ok: true, value: inputs[key] };
  }
  if (value && typeof value === "object" && !Array.isArray(value) && "$input" in (value as Record<string, unknown>)) {
    const key = (value as Record<string, unknown>)["$input"];
    if (typeof key !== "string" || !inputs || !(key in inputs)) return { ok: false, value: null };
    return { ok: true, value: inputs[key] };
  }
  return { ok: true, value };
}

// Resolves $inputs.* references at execution time. Absent inputs drop their
// effect (value null), so optional inputs like carrier or reorderPoint simply
// do not apply; required inputs are validated before execution, and the caller
// fails when nothing resolves. Missing ref names are reported for diagnostics.
// $fn.<key> references resolve from pre-computed function values (function-
// backed actions): the caller runs the function executor first and passes the
// results as fnValues. Without fnValues, $fn refs report missing — never null.
export function resolveEffect(
  e: ActionEffect,
  inputs: Record<string, unknown> | undefined,
  fnValues?: Record<string, unknown>,
): { value: ActionEffect | null; missing: string[] } {
  const missing: string[] = [];
  const ref = (v: unknown): { provided: boolean; value: unknown } => {
    if (typeof v === "string" && v.startsWith("$fn.")) {
      const key = v.slice("$fn.".length);
      if (fnValues && key in fnValues && fnValues[key] !== undefined && fnValues[key] !== null && fnValues[key] !== "") {
        return { provided: true, value: fnValues[key] };
      }
      missing.push(v);
      return { provided: false, value: null };
    }
    if (typeof v === "string" && v.startsWith("$inputs.")) {
      const r = resolveRef(v, inputs);
      if (!r.ok) {
        missing.push(v);
        return { provided: false, value: null };
      }
      return { provided: true, value: r.value };
    }
    if (v && typeof v === "object" && !Array.isArray(v) && "$input" in (v as Record<string, unknown>)) {
      const r = resolveRef(v, inputs);
      if (!r.ok) {
        missing.push(JSON.stringify(v));
        return { provided: false, value: null };
      }
      return { provided: true, value: r.value };
    }
    return { provided: true, value: v };
  };
  if (e.kind === "set") {
    const r = ref(e.value);
    if (!r.provided || r.value === undefined || r.value === null) return { value: null, missing };
    if (e.targetId !== undefined) {
      const t = ref(e.targetId);
      if (!t.provided || t.value === undefined || t.value === null || t.value === "") return { value: null, missing };
      return { value: { ...e, value: r.value, targetId: String(t.value) }, missing };
    }
    return { value: { ...e, value: r.value }, missing };
  }
  if (e.kind === "link" || e.kind === "unlink") {
    const r = ref(e.targetId);
    if (!r.provided || r.value === undefined || r.value === null || r.value === "") return { value: null, missing };
    return { value: { ...e, targetId: String(r.value) }, missing };
  }
  if (e.kind === "create" && e.data) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e.data)) {
      const r = ref(v);
      if (r.value !== undefined && r.value !== null && r.value !== "") data[k] = r.value;
    }
    if (Object.keys(data).length === 0) return { value: null, missing };
    return { value: { ...e, data }, missing };
  }
  return { value: e, missing };
}

export async function defineAction(
  organizationId: string,
  def: { key: string; label: string; targetTypeKey: string; inputs: unknown; effects: unknown; approvalPolicy: string; requiredCount: number }
) {
  const existing = await db.ontoAction.findUnique({
    where: { organizationId_key: { organizationId, key: def.key } },
  });
  if (existing) {
    const updated = await db.ontoAction.update({
      where: { id: existing.id },
      data: {
        label: def.label,
        targetTypeKey: def.targetTypeKey,
        inputs: json(def.inputs),
        effects: json(def.effects),
        approvalPolicy: def.approvalPolicy,
        requiredCount: def.requiredCount,
        version: { increment: 1 },
      },
    });
    return { ok: true as const, value: updated, created: false };
  }
  const created = await db.ontoAction.create({
    data: {
      organizationId,
      key: def.key,
      label: def.label,
      targetTypeKey: def.targetTypeKey,
      inputs: json(def.inputs),
      effects: json(def.effects),
      approvalPolicy: def.approvalPolicy,
      requiredCount: def.requiredCount,
    },
  });
  return { ok: true as const, value: created, created: true };
}

export async function requestApproval(
  organizationId: string,
  requestedById: string,
  input: { actionKey: string; objectId: string; inputs?: unknown; requiredCount?: number; expiresAt?: string }
) {
  const action = await db.ontoAction.findUnique({
    where: { organizationId_key: { organizationId, key: input.actionKey } },
  });
  if (!action || !action.enabled) return { ok: false as const, error: "unknown or disabled action" };
  const created = await db.ontoApproval.create({
    data: {
      organizationId,
      actionKey: input.actionKey,
      objectId: input.objectId,
      inputs: json(input.inputs ?? {}),
      requestedById,
      requiredCount: input.requiredCount ?? action.requiredCount,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
  await recordEvent(organizationId, { kind: "approval.requested", objectId: input.objectId, actorId: requestedById, after: { actionKey: input.actionKey } });
  const { notifyOrg } = await import("@/lib/core/notify");
  await notifyOrg(organizationId, "approval", `${input.actionKey} on ${input.objectId} needs review`, "/ontology/inbox").catch(() => undefined);
  return { ok: true as const, value: created };
}

export async function decideApproval(
  organizationId: string,
  approvalId: string,
  approverId: string,
  approve: boolean,
  comment = ""
) {
  const approval = await db.ontoApproval.findFirst({ where: { id: approvalId, organizationId } });
  if (!approval || approval.status !== "pending") return { ok: false as const, error: "approval not pending" };
  if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) {
    await db.ontoApproval.update({ where: { id: approval.id }, data: { status: "expired", decidedAt: new Date() } });
    return { ok: false as const, error: "approval expired" };
  }
  if (!approve) {
    const updated = await db.ontoApproval.update({
      where: { id: approval.id },
      data: { status: "rejected", decidedAt: new Date() },
    });
    await recordEvent(organizationId, { kind: "approval.rejected", objectId: approval.objectId, actorId: approverId, after: { comment } });
    return { ok: true as const, value: updated };
  }
  const current = ((approval.approvals as Array<{ byId: string }> | null) ?? []).map((a) => a.byId);
  const next = [...current, approverId];
  const status = quorumReached(next, approval.requiredCount) ? "approved" : "pending";
  const updated = await db.ontoApproval.update({
    where: { id: approval.id },
    data: {
      approvals: json([...((approval.approvals as unknown[] | null) ?? []), { byId: approverId, at: new Date().toISOString(), comment }]),
      status,
      decidedAt: status === "approved" ? new Date() : null,
    },
  });
  await recordEvent(organizationId, { kind: "approval.decided", objectId: approval.objectId, actorId: approverId, after: { status } });
  return { ok: true as const, value: updated };
}

export async function executeAction(
  organizationId: string,
  actorId: string,
  input: { actionKey: string; objectId: string; inputs?: unknown; idempotencyKey: string; approvalId?: string; fnValues?: Record<string, unknown> }
) {
  if (!input.idempotencyKey) return { ok: false as const, error: "idempotencyKey is required" };
  const prior = await db.ontoActionRun.findUnique({
    where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: input.idempotencyKey } },
  });
  if (prior) return { ok: true as const, value: prior, replayed: true };
  const action = await db.ontoAction.findUnique({
    where: { organizationId_key: { organizationId, key: input.actionKey } },
  });
  if (!action || !action.enabled) return { ok: false as const, error: "unknown or disabled action" };
  const object = await db.ontoObject.findFirst({
    where: { id: input.objectId, organizationId, typeKey: action.targetTypeKey, deletedAt: null },
  });
  if (!object) return { ok: false as const, error: "object not found for action target" };
  if (action.approvalPolicy !== "none") {
    if (!input.approvalId) return { ok: false as const, error: "approval required", needsApproval: true };
    const approval = await db.ontoApproval.findFirst({
      where: { id: input.approvalId, organizationId, actionKey: action.key, objectId: object.id },
    });
    if (!approval || approval.status !== "approved") {
      return { ok: false as const, error: "approval not granted", needsApproval: true };
    }
  }
  const rawEffects = (action.effects as unknown[] as ActionEffect[]);
  // Pre-commit webhooks veto before anything writes. No hook configured
  // means pass-through; a failing hook blocks with its reason (fail-closed).
  const gate = await runPreCommitWebhooks(
    organizationId,
    action.key,
    object.id,
    actorId,
    (input.inputs as Record<string, unknown>) ?? {},
  );
  if (!gate.ok) return { ok: false as const, error: gate.error ?? "pre-commit webhook blocked the write" };
  const resolved: ActionEffect[] = [];
  const unresolved: string[] = [];
  for (const e of rawEffects) {
    const r = resolveEffect(e, (input.inputs as Record<string, unknown>) ?? undefined, input.fnValues);
    unresolved.push(...r.missing);
    if (r.value) resolved.push(r.value);
  }
  if (resolved.length === 0) {
    return {
      ok: false as const,
      error: unresolved.length > 0 ? `unresolved input reference: ${[...new Set(unresolved)].join(", ")}` : "no resolvable effects",
    };
  }
  const before = (object.data as Record<string, unknown>) ?? {};
  const targeted = resolved.filter((e) => e.kind === "set" && e.targetId);
  const main = resolved.filter((e) => !(e.kind === "set" && e.targetId));
  const preview = [...dryRunSet(before, main)];
  for (const e of targeted) {
    preview.push({ effect: `set ${e.property} -> ${e.targetId}`, before: "external", after: e.value ?? null });
  }
  const after = applySetEffects(before, main);
  await db.ontoObject.update({ where: { id: object.id }, data: { data: json(after), version: { increment: 1 } } });
  const createdIds: string[] = [];
  const createErrors: string[] = [];
  for (const e of main) {
    if (e.kind === "link" && e.linkKey && e.targetId) {
      await createEdgeInstance(organizationId, object.id, e.linkKey, e.targetId);
    }
    if (e.kind === "unlink" && e.linkKey && e.targetId) {
      await db.ontoEdge.deleteMany({ where: { organizationId, fromId: object.id, linkKey: e.linkKey, toId: e.targetId } });
    }
    if (e.kind === "create" && e.typeKey && e.data) {
      const data = e.data as Record<string, unknown>;
      const key = typeof data.key === "string" && data.key.trim() !== "" ? data.key : naturalKeyFor(e.typeKey, data);
      const created = await createObject(organizationId, e.typeKey, { key, data });
      if (created.ok) createdIds.push(created.value.id);
      else createErrors.push(`${e.typeKey}: ${created.error}`);
    }
  }
  for (const e of targeted) {
    if (!e.targetId || !e.property) continue;
    const target = await db.ontoObject.findFirst({
      where: { id: e.targetId, organizationId, deletedAt: null },
    });
    if (!target) {
      createErrors.push(`set target ${e.targetId} not found`);
      continue;
    }
    const tBefore = (target.data as Record<string, unknown>) ?? {};
    const tAfter = applySetEffects(tBefore, [e]);
    await db.ontoObject.update({ where: { id: target.id }, data: { data: json(tAfter), version: { increment: 1 } } });
    await recordEvent(organizationId, { kind: "action.executed", objectId: target.id, actorId, before: tBefore, after: tAfter });
  }
  await recordEvent(organizationId, { kind: "action.executed", objectId: object.id, actorId, before, after });
  try {
    const run = await db.ontoActionRun.create({
      data: {
        organizationId,
        idempotencyKey: input.idempotencyKey,
        actionKey: action.key,
        objectId: object.id,
        result: json({ preview, createdIds, createErrors }),
      },
    });
    return { ok: true as const, value: run, replayed: false };
  } catch {
    const raced = await db.ontoActionRun.findUnique({
      where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: input.idempotencyKey } },
    });
    return { ok: true as const, value: raced!, replayed: true };
  }
}

export async function findUnusedActions(organizationId: string): Promise<string[]> {
  const [actions, runs] = await Promise.all([
    db.ontoAction.findMany({ where: { organizationId, enabled: true }, select: { key: true } }),
    db.ontoActionRun.groupBy({ by: ["actionKey"], where: { organizationId } }),
  ]);
  const used = new Set(runs.map((r) => r.actionKey));
  return actions.map((a) => a.key).filter((k) => !used.has(k));
}

export type UndoStrategy = "compensating-action" | "revert" | "audit-restore";

export interface UndoPlan {
  strategy: UndoStrategy;
  actionKey?: string;
  steps: string[];
}

const COMPENSATING: Record<string, { actionKey?: string; steps: string[] }> = {
  mfg_transfer_stock: {
    actionKey: "mfg_transfer_stock",
    steps: ["re-run mfg_transfer_stock with source and target swapped for the moved qty"],
  },
  mfg_create_shipment: {
    actionKey: "mfg_reroute_shipment",
    steps: ["reroute the created shipment to a holding destination, then cancel it"],
  },
  mfg_reroute_shipment: {
    actionKey: "mfg_reroute_shipment",
    steps: ["reroute back to the original destination recorded in the audit before-image"],
  },
  mfg_record_production: {
    steps: ["record a correcting fact with the delta (append-only; production facts are never edited)"],
  },
  mfg_adjust_safety_stock: {
    steps: ["re-apply mfg_adjust_safety_stock with the prior value from the audit before-image"],
  },
  mfg_resolve_delay: {
    steps: ["re-open the delay by flagging the shipment figure again with reason"],
  },
};

// Every executed action names its way back. Corrections revert in bulk,
// manufacturing compensates by re-running, and everything else restores
// from the hash-chained before-image — nothing is ever deleted.
export function describeUndo(actionKey: string): UndoPlan {
  const comp = COMPENSATING[actionKey];
  if (comp) {
    return { strategy: "compensating-action", actionKey: comp.actionKey, steps: comp.steps };
  }
  if (actionKey.startsWith("correct") || actionKey === "revert_user" || actionKey.includes("rule")) {
    return {
      strategy: "revert",
      steps: ["use revert_user (corrections) or disable the standing rule, then recompute affected weeks"],
    };
  }
  return {
    strategy: "audit-restore",
    steps: [
      "read the action.executed audit event for this run",
      "restore the before-image through update_object (versioned, itself audited)",
    ],
  };
}
