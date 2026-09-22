import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { validateLinkInput, validateTypeInput } from "@/lib/core/ontology/schema";
import type { TypeSnapshot } from "@/lib/core/ontology/versions";
import { diffTypeSnapshots, planMigration } from "@/lib/core/ontology/versions";
import { recordEvent } from "@/lib/core/ontology/facts";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function listTypes(organizationId: string, includeDeleted = false, take = 500) {
  return db.ontoType.findMany({
    where: { organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: { properties: true },
    orderBy: { key: "asc" },
    take: Math.min(Math.max(take, 1), 1000),
  });
}

export async function createType(organizationId: string, createdById: string, input: unknown) {
  const parsed = validateTypeInput(input);
  if (!parsed.ok) return parsed;
  const existing = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key: parsed.value.key } },
  });
  if (existing) {
    return { ok: false as const, problems: [{ field: "key", message: "type key already exists" }] };
  }
  const created = await db.ontoType.create({
    data: {
      organizationId,
      key: parsed.value.key,
      label: parsed.value.label,
      plural: parsed.value.plural,
      description: parsed.value.description,
      properties: {
        create: parsed.value.properties.map((p) => ({
          organizationId,
          key: p.key,
          label: p.label,
          kind: p.kind,
          required: p.required,
          unique: p.unique,
          indexed: p.indexed,
          immutable: p.immutable,
          config: p.config === undefined ? undefined : json(p.config),
        })),
      },
      versions: {
        create: {
          organizationId,
          version: 1,
          snapshot: json(parsed.value),
          note: "initial version",
          createdById,
        },
      },
    },
    include: { properties: true },
  });
  await recordEvent(organizationId, {
    kind: "ontology:type:created",
    actorId: createdById,
    after: { key: created.key, version: 1 },
  });
  return { ok: true as const, value: created };
}

export async function updateType(organizationId: string, createdById: string, key: string, input: unknown) {
  const current = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key } },
    include: { properties: true },
  });
  if (!current || current.deletedAt) {
    return { ok: false as const, problems: [{ field: "key", message: "type not found" }] };
  }
  const parsed = validateTypeInput({ ...(input as object), key });
  if (!parsed.ok) return parsed;
  const oldSnap: TypeSnapshot = {
    key: current.key,
    label: current.label,
    plural: current.plural,
    description: current.description,
    properties: current.properties.map((p) => ({
      key: p.key,
      label: p.label,
      kind: p.kind,
      required: p.required,
      unique: p.unique,
      indexed: p.indexed,
      immutable: p.immutable,
      config: (p.config as Record<string, unknown>) ?? undefined,
    })),
  };
  const newSnap: TypeSnapshot = {
    key: parsed.value.key,
    label: parsed.value.label,
    plural: parsed.value.plural,
    description: parsed.value.description,
    properties: parsed.value.properties.map((p) => ({
      key: p.key,
      label: p.label,
      kind: p.kind,
      required: p.required,
      unique: p.unique,
      indexed: p.indexed,
      immutable: p.immutable,
      config: p.config as Record<string, unknown> | undefined,
    })),
  };
  const diff = diffTypeSnapshots(oldSnap, newSnap);
  const plan = planMigration(diff);
  const nextVersion = current.version + 1;  await db.$transaction([
    db.ontoProperty.deleteMany({ where: { typeId: current.id } }),
    db.ontoType.update({
      where: { id: current.id },
      data: {
        label: parsed.value.label,
        plural: parsed.value.plural,
        description: parsed.value.description,
        version: nextVersion,
        properties: {
          create: parsed.value.properties.map((p) => ({
            organizationId,
            key: p.key,
            label: p.label,
            kind: p.kind,
            required: p.required,
            unique: p.unique,
            indexed: p.indexed,
            immutable: p.immutable,
            config: p.config === undefined ? undefined : json(p.config),
          })),
        },
      },
    }),
    db.ontoTypeVersion.create({
      data: {
        organizationId,
        typeId: current.id,
        version: nextVersion,
        snapshot: json(parsed.value),
        note: `diff: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`,
        createdById,
      },
    }),
  ]);
  await recordEvent(organizationId, {
    kind: "ontology:type:updated",
    actorId: createdById,
    before: { key, version: current.version },
    after: {
      key,
      version: nextVersion,
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      destructive: plan.some((s) => s.destructive),
    },
  });
  return { ok: true as const, value: { version: nextVersion, diff, plan } };
}

export async function revertTypeVersion(organizationId: string, createdById: string, key: string, version: number) {
  const snap = await db.ontoTypeVersion.findFirst({
    where: { organizationId, version, type: { organizationId, key } },
  });
  if (!snap) {
    return { ok: false as const, problems: [{ field: "version", message: `no snapshot for version ${version}` }] };
  }
  const res = await updateType(organizationId, createdById, key, snap.snapshot as object);
  if (!res.ok) return res;
  await recordEvent(organizationId, {
    kind: "ontology:type:reverted",
    actorId: createdById,
    after: { key, toVersion: version },
  });
  return res;
}

export async function findUnusedTypes(organizationId: string): Promise<string[]> {
  const [types, used] = await Promise.all([
    db.ontoType.findMany({ where: { organizationId, deletedAt: null }, select: { key: true } }),
    db.ontoObject.groupBy({ by: ["typeKey"], where: { organizationId, deletedAt: null } }),
  ]);
  const live = new Set(used.map((u) => u.typeKey));
  return types.map((t) => t.key).filter((k) => !live.has(k));
}

export async function deprecateType(organizationId: string, key: string, actorId = "") {
  const current = await db.ontoType.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current || current.deletedAt) {
    return { ok: false as const, problems: [{ field: "key", message: "type not found" }] };
  }
  const updated = await db.ontoType.update({
    where: { id: current.id },
    data: { status: "deprecated", deletedAt: new Date() },
  });
  await recordEvent(organizationId, {
    kind: "ontology:type:deprecated",
    actorId,
    before: { key },
    after: { key, status: "deprecated" },
  });
  return { ok: true as const, value: updated };
}

export async function createLink(organizationId: string, input: unknown, actorId = "") {
  const types = await db.ontoType.findMany({
    where: { organizationId, deletedAt: null },
    select: { key: true },
  });
  const parsed = validateLinkInput(input, new Set(types.map((t) => t.key)));
  if (!parsed.ok) return parsed;
  const existing = await db.ontoLink.findUnique({
    where: { organizationId_key: { organizationId, key: parsed.value.key } },
  });
  if (existing) {
    return { ok: false as const, problems: [{ field: "key", message: "link key already exists" }] };
  }
  const created = await db.ontoLink.create({
    data: {
      organizationId,
      key: parsed.value.key,
      fromTypeKey: parsed.value.fromTypeKey,
      toTypeKey: parsed.value.toTypeKey,
      cardinality: parsed.value.cardinality,
      required: parsed.value.required,
      inverseKey:
        parsed.value.fromTypeKey === parsed.value.toTypeKey
          ? `${parsed.value.key}_of`
          : `${parsed.value.toTypeKey}_of_${parsed.value.fromTypeKey}`,
    },
  });
  await recordEvent(organizationId, {
    kind: "ontology:link:created",
    actorId,
    after: { key: created.key, cardinality: created.cardinality },
  });
  return { ok: true as const, value: created };
}

export async function updateLink(organizationId: string, actorId: string, key: string, input: unknown) {
  const current = await db.ontoLink.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current) {
    return { ok: false as const, problems: [{ field: "key", message: "link not found" }] };
  }
  // Links carry no version history: a change is a transactional
  // delete + recreate under the same key, with before/after on the audit
  // chain as the diff note. Cardinality changes are destructive by nature
  // (edges that violate the new rule are left for review, never rewritten).
  const types = await db.ontoType.findMany({
    where: { organizationId, deletedAt: null },
    select: { key: true },
  });
  const parsed = validateLinkInput({ ...(input as object), key }, new Set(types.map((t) => t.key)));
  if (!parsed.ok) return parsed;
  const updated = await db.$transaction(async (tx) => {
    await tx.ontoLink.delete({ where: { id: current.id } });
    return tx.ontoLink.create({
      data: {
        organizationId,
        key,
        fromTypeKey: parsed.value.fromTypeKey,
        toTypeKey: parsed.value.toTypeKey,
        cardinality: parsed.value.cardinality,
        required: parsed.value.required,
        inverseKey:
          parsed.value.fromTypeKey === parsed.value.toTypeKey
            ? `${key}_of`
            : `${parsed.value.toTypeKey}_of_${parsed.value.fromTypeKey}`,
      },
    });
  });
  await recordEvent(organizationId, {
    kind: "ontology:link:updated",
    actorId,
    before: { key, cardinality: current.cardinality, from: current.fromTypeKey, to: current.toTypeKey },
    after: {
      key,
      cardinality: updated.cardinality,
      from: updated.fromTypeKey,
      to: updated.toTypeKey,
    },
  });
  return { ok: true as const, value: updated, note: "link replaced transactionally; prior definition on the audit chain" };
}

export async function deleteLink(organizationId: string, actorId: string, key: string) {  const current = await db.ontoLink.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (!current) {
    return { ok: false as const, problems: [{ field: "key", message: "link not found" }] };
  }
  const edgeCount = await db.ontoEdge.count({ where: { organizationId, linkKey: key } });
  if (edgeCount > 0) {
    return {
      ok: false as const,
      problems: [{ field: "key", message: `link in use by ${edgeCount} edge(s) — unlink them first` }],
    };
  }
  await db.ontoLink.delete({ where: { id: current.id } });
  await recordEvent(organizationId, {
    kind: "ontology:link:deleted",
    actorId,
    before: { key, cardinality: current.cardinality },
  });
  return { ok: true as const, value: { key } };
}

export async function exportTypeSet(organizationId: string) {
  const types = await listTypes(organizationId);
  const links = await db.ontoLink.findMany({ where: { organizationId }, orderBy: { key: "asc" } });
  return { version: 1, exportedAt: new Date().toISOString(), types, links };
}

export async function findUnusedLinks(organizationId: string): Promise<string[]> {
  const [links, used] = await Promise.all([
    db.ontoLink.findMany({ where: { organizationId }, select: { key: true } }),
    db.ontoEdge.groupBy({ by: ["linkKey"], where: { organizationId } }),
  ]);
  const live = new Set(used.map((u) => u.linkKey));
  return links.map((l) => l.key).filter((k) => !live.has(k));
}

export async function revertLink(organizationId: string, actorId: string, key: string) {
  // Rollback via the audit chain: the last link:updated event carries the
  // prior definition in `before`; re-applying it is itself versioned there.
  const events = await db.ontoEvent.findMany({
    where: { organizationId, kind: "ontology:link:updated" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  for (const e of events) {
    const after = e.after as unknown as { key?: string } | null;
    if (after?.key !== key) continue;
    const before = e.before as unknown as {
      cardinality?: string;
      from?: string;
      to?: string;
    } | null;
    if (!before?.cardinality || !before.from || !before.to) {
      return { ok: false as const, problems: [{ field: "key", message: "last change has no restorable definition" }] };
    }
    return updateLink(organizationId, actorId, key, {
      fromTypeKey: before.from,
      toTypeKey: before.to,
      cardinality: before.cardinality,
    });
  }
  return { ok: false as const, problems: [{ field: "key", message: "no prior definition on the audit chain" }] };
}
