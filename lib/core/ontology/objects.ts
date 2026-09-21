import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { coerceValue } from "@/lib/core/ontology/kinds";
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
    config: unknown;
  }>;
};

function coerceData(
  type: ObjectType,
  data: Record<string, unknown>
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const coerced: Record<string, unknown> = {};
  for (const prop of type.properties) {
    const raw = (data as Record<string, unknown>)[prop.key];
    if ((raw === null || raw === undefined || raw === "") && prop.required) {
      return { ok: false, error: `missing required property ${prop.key}` };
    }
    const res = coerceValue(
      prop.kind as Parameters<typeof coerceValue>[0],
      raw,
      (prop.config as Record<string, unknown>) ?? undefined
    );
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
  const coerced = coerceData(type, input.data);
  if (!coerced.ok) return coerced;
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
  const coerced = coerceData(type, input.data);
  if (!coerced.ok) return coerced;
  const existing = await db.ontoObject.findUnique({
    where: { organizationId_typeKey_key: { organizationId, typeKey, key } },
  });
  if (!existing) {
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
