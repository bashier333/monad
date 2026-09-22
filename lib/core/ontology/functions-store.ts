import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import {
  executeFunctionSpec,
  recordFunctionCall,
  snapshotOf,
  validateFunctionSpec,
  versionNote,
  type ExecuteOpts,
  type FunctionSpec,
} from "@/lib/core/ontology/functions";
import { recordEvent } from "@/lib/core/ontology/facts";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function defineFunction(organizationId: string, createdById: string, input: unknown) {
  const parsed = validateFunctionSpec(input);
  if (!parsed.ok) return parsed;
  const existing = await db.ontoFunction.findUnique({
    where: { organizationId_key: { organizationId, key: parsed.value.key } },
  });
  if (existing) {
    return { ok: false as const, problems: [{ field: "key", message: "function key already exists" }] };
  }
  const created = await db.ontoFunction.create({
    data: {
      organizationId,
      key: parsed.value.key,
      label: parsed.value.label,
      targetTypeKey: parsed.value.targetTypeKey,
      pure: parsed.value.pure,
      budgetMs: parsed.value.budgetMs,
      kind: parsed.value.kind,
      code: json(parsed.value.code),
      createdById,
      versions: {
        create: { organizationId, version: 1, snapshot: json(snapshotOf(parsed.value)), note: "initial version", createdById },
      },
    },
  });
  await recordEvent(organizationId, {
    kind: "ontology:function:defined",
    actorId: createdById,
    after: { key: created.key, kind: created.kind, version: 1 },
  });
  return { ok: true as const, value: created };
}

export async function listFunctions(organizationId: string, includeDisabled = false) {
  return db.ontoFunction.findMany({
    where: { organizationId, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: { key: "asc" },
    take: 500,
  });
}

export async function getFunction(
  organizationId: string,
  key: string,
  version?: number,
): Promise<{ ok: true; spec: FunctionSpec; version: number } | { ok: false; error: string }> {
  const fn = await db.ontoFunction.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!fn || (!fn.enabled && version == null)) return { ok: false, error: "unknown or disabled function" };
  if (version == null) {
    return {
      ok: true,
      spec: {
        key: fn.key,
        label: fn.label,
        targetTypeKey: fn.targetTypeKey ?? undefined,
        pure: fn.pure,
        budgetMs: fn.budgetMs,
        kind: fn.kind as FunctionSpec["kind"],
        code: (fn.code as Record<string, unknown>) ?? {},
        enabled: fn.enabled,
      },
      version: fn.version,
    };
  }
  const snap = await db.ontoFunctionVersion.findUnique({
    where: { functionId_version: { functionId: fn.id, version } },
  });
  if (!snap) return { ok: false, error: `no snapshot for version ${version}` };
  const parsed = validateFunctionSpec(snap.snapshot as object);
  if (!parsed.ok) return { ok: false, error: "stored snapshot failed validation" };
  return { ok: true, spec: parsed.value, version };
}

export async function updateFunction(organizationId: string, createdById: string, key: string, input: unknown) {
  const current = await db.ontoFunction.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current) return { ok: false as const, error: "unknown function" };
  const parsed = validateFunctionSpec({ ...(input as object), key });
  if (!parsed.ok) return parsed;
  const prevSnap = await db.ontoFunctionVersion.findUnique({
    where: { functionId_version: { functionId: current.id, version: current.version } },
  });
  const prev = (prevSnap?.snapshot as Record<string, unknown> | null) ?? null;
  const next = snapshotOf(parsed.value);
  const note = versionNote(prev, next);
  const nextVersion = current.version + 1;
  await db.$transaction([
    db.ontoFunction.update({
      where: { id: current.id },
      data: {
        label: parsed.value.label,
        targetTypeKey: parsed.value.targetTypeKey,
        pure: parsed.value.pure,
        budgetMs: parsed.value.budgetMs,
        kind: parsed.value.kind,
        code: json(parsed.value.code),
        version: nextVersion,
      },
    }),
    db.ontoFunctionVersion.create({
      data: { organizationId, functionId: current.id, version: nextVersion, snapshot: json(next), note, createdById },
    }),
  ]);
  await recordEvent(organizationId, {
    kind: "ontology:function:updated",
    actorId: createdById,
    before: { key, version: current.version },
    after: { key, version: nextVersion, note },
  });
  return { ok: true as const, value: { version: nextVersion, note } };
}

export async function rollbackFunction(organizationId: string, createdById: string, key: string, version: number) {
  const snap = await db.ontoFunctionVersion.findFirst({
    where: { organizationId, version, fn: { organizationId, key } },
  });
  if (!snap) return { ok: false as const, error: `no snapshot for version ${version}` };
  // Rollback appends a NEW version carrying the old snapshot: history is
  // never rewritten, so audit stays a straight line.
  const res = await updateFunction(organizationId, createdById, key, snap.snapshot as object);
  if (!res.ok) return res;
  await recordEvent(organizationId, {
    kind: "ontology:function:rolled-back",
    actorId: createdById,
    after: { key, toVersion: version },
  });
  return res;
}

export async function deleteFunction(organizationId: string, createdById: string, key: string) {
  const current = await db.ontoFunction.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current) return { ok: false as const, error: "unknown function" };
  const actions = await db.ontoAction.findMany({
    where: { organizationId, enabled: true },
    select: { key: true, effects: true },
    take: 1000,
  });
  const users = actions.filter((a) => JSON.stringify(a.effects ?? []).includes(`$fn.${key}`)).map((a) => a.key);
  if (users.length > 0) {
    return { ok: false as const, error: `function backs actions: ${users.join(", ")} — rewrite them first` };
  }
  await db.ontoFunction.delete({ where: { id: current.id } });
  await recordEvent(organizationId, {
    kind: "ontology:function:deleted",
    actorId: createdById,
    before: { key },
  });
  return { ok: true as const, value: { key } };
}

export async function findUnusedFunctions(organizationId: string, idleMs = 90 * 24 * 3600 * 1000): Promise<string[]> {
  const now = Date.now();
  const fns = await db.ontoFunction.findMany({
    where: { organizationId },
    select: { key: true, lastExecutedAt: true },
    take: 1000,
  });
  return fns.filter((f) => !f.lastExecutedAt || now - f.lastExecutedAt.getTime() > idleMs).map((f) => f.key);
}

export async function executeStoredFunction(
  organizationId: string,
  key: string,
  args: Record<string, unknown>,
  opts: ExecuteOpts & { nativeHandlers?: import("@/lib/core/ontology/functions").NativeHandlers } = {},
) {
  const loaded = await getFunction(organizationId, key, opts.version);
  if (!loaded.ok) return { ok: false as const, error: loaded.error, version: null, latencyMs: 0 };
  const res = await executeFunctionSpec(loaded.spec, args, { ...opts, version: loaded.version });
  recordFunctionCall(`${organizationId}:${key}`, res.ok, res.latencyMs);
  await db.ontoFunction.updateMany({
    where: { organizationId, key },
    data: { lastExecutedAt: new Date() },
  });
  return res;
}
