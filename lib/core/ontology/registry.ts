import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { validateLinkInput, validateTypeInput } from "@/lib/core/ontology/schema";
import type { TypeSnapshot } from "@/lib/core/ontology/versions";
import { diffTypeSnapshots, planMigration } from "@/lib/core/ontology/versions";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function listTypes(organizationId: string, includeDeleted = false) {
  return db.ontoType.findMany({
    where: { organizationId, ...(includeDeleted ? {} : { deletedAt: null }) },
    include: { properties: true },
    orderBy: { key: "asc" },
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
  const nextVersion = current.version + 1;
  await db.$transaction([
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
  return { ok: true as const, value: { version: nextVersion, diff, plan } };
}

export async function deprecateType(organizationId: string, key: string) {
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
  return { ok: true as const, value: updated };
}

export async function createLink(organizationId: string, input: unknown) {
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
  return { ok: true as const, value: created };
}

export async function exportTypeSet(organizationId: string) {
  const types = await listTypes(organizationId);
  const links = await db.ontoLink.findMany({ where: { organizationId }, orderBy: { key: "asc" } });
  return { version: 1, exportedAt: new Date().toISOString(), types, links };
}
