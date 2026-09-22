import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { coerceValue } from "@/lib/core/ontology/kinds";
import { recordKindOutcome } from "@/lib/core/ontology/kinds-telemetry";
import { normalizeKey, stableObjectKey } from "@/lib/core/ontology/identity";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export interface InstanceInput {
  key: string;
  data: Record<string, unknown>;
}

type ObjectType = {
  deletedAt: Date | null;
  properties: Array<{
    key: string;
    kind: string;
    required: boolean;
    unique: boolean;
    immutable: boolean;
    config: unknown;
  }>;
};

export function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Immutable guard: post-create edits to immutable props are rejected, never merged. */
export function checkImmutableViolation(
  prev: Record<string, unknown> | null,
  props: Array<{ key: string; immutable: boolean }>,
  merged: Record<string, unknown>,
): string | null {
  if (!prev) return null;
  for (const p of props) {
    if (!p.immutable) continue;
    if (p.key in merged && !valuesEqual(prev[p.key], merged[p.key])) {
      return `${p.key}: immutable — cannot change after creation`;
    }
  }
  return null;
}

/** Pure duplicate scan over candidate rows (DB scan stays provider-agnostic). */
export function findUniqueViolations(
  candidates: Array<{ key: string; data: Record<string, unknown> }>,
  propKey: string,
  value: unknown,
  selfKey: string | null,
): string[] {
  if (value === null || value === undefined || value === "") return [];
  return candidates
    .filter((c) => c.key !== selfKey && valuesEqual(c.data[propKey], value))
    .map((c) => c.key);
}

const UNIQUE_SCAN_TAKE = 50_000;

async function uniqueViolation(
  organizationId: string,
  typeKey: string,
  props: Array<{ key: string; unique: boolean }>,
  data: Record<string, unknown>,
  selfKey: string | null,
): Promise<string | null> {
  const uniqueProps = props.filter((p) => p.unique && data[p.key] !== undefined && data[p.key] !== null && data[p.key] !== "");
  if (uniqueProps.length === 0) return null;
  const rows = await db.ontoObject.findMany({
    where: { organizationId, typeKey, deletedAt: null },
    select: { key: true, data: true },
    take: UNIQUE_SCAN_TAKE,
  });
  for (const p of uniqueProps) {
    const dups = findUniqueViolations(
      rows.map((r) => ({ key: r.key, data: (r.data as Record<string, unknown>) ?? {} })),
      p.key,
      data[p.key],
      selfKey,
    );
    if (dups.length > 0) return `duplicate ${p.key}: already used by ${dups[0]}`;
  }
  return null;
}

function coerceData(
  organizationId: string,
  type: ObjectType,
  data: Record<string, unknown>
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const coerced: Record<string, unknown> = {};
  for (const prop of type.properties) {
    const raw = (data as Record<string, unknown>)[prop.key];
    if ((raw === null || raw === undefined || raw === "") && prop.required) {
      recordKindOutcome(organizationId, prop.kind as Parameters<typeof coerceValue>[0], false);
      return { ok: false, error: `missing required property ${prop.key}` };
    }
    const kind = prop.kind as Parameters<typeof coerceValue>[0];
    const res = coerceValue(
      kind,
      raw,
      (prop.config as Record<string, unknown>) ?? undefined
    );
    recordKindOutcome(organizationId, kind, res.ok);
    if (!res.ok) return { ok: false, error: `${prop.key}: ${res.error}` };
    if (res.value !== null) coerced[prop.key] = res.value;
  }
  return { ok: true, value: coerced };
}

export async function createObject(
  organizationId: string,
  typeKey: string,
  input: InstanceInput
) {
  const type = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key: typeKey } },
    include: { properties: true },
  });
  if (!type || type.deletedAt) return { ok: false as const, error: "unknown type" };
  const key = normalizeKey(input.key);
  if (!key) return { ok: false as const, error: "empty key" };
  const coerced = coerceData(organizationId, type, input.data);
  if (!coerced.ok) return coerced;
  const dup = await uniqueViolation(organizationId, typeKey, type.properties, coerced.value, null);
  if (dup) return { ok: false as const, error: dup };
  try {
    const created = await db.ontoObject.create({
      data: { organizationId, typeKey, key, data: json(coerced.value) },
    });
    return { ok: true as const, value: created };
  } catch {
    return { ok: false as const, error: "duplicate key" };
  }
}

export async function upsertObject(organizationId: string, typeKey: string, input: InstanceInput) {
  const type = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key: typeKey } },
    include: { properties: true },
  });
  if (!type || type.deletedAt) return { ok: false as const, error: "unknown type" };
  const key = normalizeKey(input.key);
  if (!key) return { ok: false as const, error: "empty key" };
  const coerced = coerceData(organizationId, type, input.data);
  if (!coerced.ok) return coerced;
  const existing = await db.ontoObject.findUnique({
    where: { organizationId_typeKey_key: { organizationId, typeKey, key } },
  });
  if (!existing) {
    const dup = await uniqueViolation(organizationId, typeKey, type.properties, coerced.value, null);
    if (dup) return { ok: false as const, error: dup };
    try {
      const created = await db.ontoObject.create({
        data: { organizationId, typeKey, key, data: json(coerced.value) },
      });
      return { ok: true as const, value: created };
    } catch {
      return { ok: false as const, error: "duplicate key" };
    }
  }
  // Merge, never clobber: partial import payloads must not wipe fields they
  // do not carry (e.g. a stock row must not erase a warehouse's region).
  const merged = { ...((existing.data as Record<string, unknown>) ?? {}), ...coerced.value };
  const frozen = checkImmutableViolation(
    (existing.data as Record<string, unknown>) ?? {},
    type.properties,
    merged,
  );
  if (frozen) return { ok: false as const, error: frozen };
  const dup = await uniqueViolation(organizationId, typeKey, type.properties, merged, key);
  if (dup) return { ok: false as const, error: dup };
  const updated = await db.ontoObject.update({
    where: { id: existing.id },
    data: { data: json(merged), version: { increment: 1 } },
  });
  return { ok: true as const, value: updated };
}

export async function listObjects(
  organizationId: string,
  typeKey: string,
  opts: { cursor?: string; take?: number; query?: string } = {}
) {
  const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
  const where = {
    organizationId,
    typeKey,
    deletedAt: null,
    ...(opts.query ? { key: { contains: normalizeKey(opts.query) } } : {}),
  };
  const rows = await db.ontoObject.findMany({
    where,
    orderBy: { key: "asc" },
    take: take + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const nextCursor = rows.length > take ? rows[take]!.id : null;
  return { rows: rows.slice(0, take), nextCursor };
}

export function naturalKeyFor(typeKey: string, data: Record<string, unknown>): string {
  const first = Object.values(data).find((v) => typeof v === "string" && v.trim() !== "");
  return stableObjectKey(typeKey, typeof first === "string" ? first : "unknown");
}
