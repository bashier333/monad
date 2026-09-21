import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";
import { threeWayMerge, type BranchChange } from "@/lib/core/ontology/branches";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createBranch(
  organizationId: string,
  createdById: string,
  name: string,
  baseVersions: Record<string, number>
) {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name)) return { ok: false as const, error: "bad branch name" };
  try {
    const created = await db.ontoBranch.create({
      data: { organizationId, name, baseVersions: json(baseVersions), changes: json([]), createdById },
    });
    return { ok: true as const, value: created };
  } catch {
    return { ok: false as const, error: "branch already exists" };
  }
}

export async function stageChange(organizationId: string, name: string, change: BranchChange) {
  const branch = await db.ontoBranch.findUnique({
    where: { organizationId_name: { organizationId, name } },
  });
  if (!branch || branch.status !== "open") return { ok: false as const, error: "branch not open" };
  const changes = ((branch.changes as unknown[] | null) ?? []) as BranchChange[];
  const next = [...changes.filter((c) => c.objectId !== change.objectId), change];
  const updated = await db.ontoBranch.update({
    where: { id: branch.id },
    data: { changes: json(next) },
  });
  return { ok: true as const, value: updated };
}

export async function mergeBranch(organizationId: string, actorId: string, name: string) {
  const branch = await db.ontoBranch.findUnique({
    where: { organizationId_name: { organizationId, name } },
  });
  if (!branch || branch.status !== "open") return { ok: false as const, error: "branch not open" };
  const changes = ((branch.changes as unknown[] | null) ?? []) as BranchChange[];
  const baseVersions = ((branch.baseVersions as Record<string, number> | null) ?? {});
  const ids = changes.map((c) => c.objectId);
  const mains = await db.ontoObject.findMany({ where: { organizationId, id: { in: ids } } });
  const base = new Map(
    Object.entries(baseVersions).map(([id, version]) => [id, { version, data: {} as Record<string, unknown> }])
  );
  const main = new Map(
    mains.filter((m) => !m.deletedAt).map((m) => [m.id, { version: m.version, data: (m.data as Record<string, unknown>) ?? {} }])
  );
  const outcome = threeWayMerge(base, main, changes);
  for (const id of outcome.applied) {
    const change = changes.find((c) => c.objectId === id)!;
    await db.ontoObject.update({ where: { id }, data: { data: json(change.data), version: { increment: 1 } } });
  }
  await db.ontoBranch.update({
    where: { id: branch.id },
    data: { status: outcome.conflicts.length > 0 ? "open" : "merged" },
  });
  const { recordEvent } = await import("@/lib/core/ontology/facts");
  await recordEvent(organizationId, { kind: "branch.merged", actorId, after: { branch: name, outcome } });
  return { ok: true as const, value: outcome };
}

export async function buildPackManifest(organizationId: string) {
  const [types, links, actions, policies] = await Promise.all([
    db.ontoType.findMany({ where: { organizationId, deletedAt: null }, include: { properties: true }, orderBy: { key: "asc" } }),
    db.ontoLink.findMany({ where: { organizationId }, orderBy: { key: "asc" } }),
    db.ontoAction.findMany({ where: { organizationId, enabled: true }, orderBy: { key: "asc" } }),
    db.ontoPolicy.findMany({ where: { organizationId, active: true }, orderBy: { priority: "asc" } }),
  ]);
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: { types: types.length, links: links.length, actions: actions.length, policies: policies.length },
    types,
    links,
    actions,
    policies,
  };
}
