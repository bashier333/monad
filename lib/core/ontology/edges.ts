import { db, txSerializable } from "@/lib/core/db";
import { checkCardinality } from "@/lib/core/ontology/versions";
import { bfs, buildAdjacency, type AdjEdge } from "@/lib/core/ontology/graph";

export async function createEdgeInstance(
  organizationId: string,
  fromId: string,
  linkKey: string,
  toId: string
) {
  const [link, from, to] = await Promise.all([
    db.ontoLink.findUnique({ where: { organizationId_key: { organizationId, key: linkKey } } }),
    db.ontoObject.findFirst({ where: { id: fromId, organizationId, deletedAt: null } }),
    db.ontoObject.findFirst({ where: { id: toId, organizationId, deletedAt: null } }),
  ]);
  if (!link) return { ok: false as const, error: "unknown link" };
  if (!from || !to) return { ok: false as const, error: "unknown object" };
  // OCC cardinality at write: count + create run in one serializable
  // transaction so two concurrent writers cannot both pass the check. Retry
  // on serialization conflict; the unique constraint is the final backstop.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          if (link.cardinality === "one-one" || link.cardinality === "one-many") {
            const existing = await tx.ontoEdge.count({ where: { organizationId, fromId, linkKey } });
            const check = checkCardinality(link.cardinality as "one-one" | "one-many" | "many-many", existing);
            if (!check.ok) return { ok: false as const, error: check.error };
          }
          try {
            const created = await tx.ontoEdge.create({ data: { organizationId, fromId, linkKey, toId } });
            return { ok: true as const, value: created };
          } catch (e) {
            if ((e as { code?: string }).code === "P2002") {
              return { ok: false as const, error: "edge already exists" };
            }
            throw e;
          }
        },
        txSerializable()
      );
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2034" && attempt < 2) continue;
      if (code === "P2002") return { ok: false as const, error: "edge already exists" };
      return { ok: false as const, error: "edge write failed" };
    }
  }
  return { ok: false as const, error: "edge write failed" };
}

export async function deleteEdgeInstance(organizationId: string, fromId: string, linkKey: string, toId: string) {
  const res = await db.ontoEdge.deleteMany({ where: { organizationId, fromId, linkKey, toId } });
  return res.count > 0
    ? { ok: true as const }
    : { ok: false as const, error: "edge not found" };
}

async function loadAdjacency(organizationId: string, linkKeys?: string[]): Promise<{ out: Map<string, AdjEdge[]>; incoming: Map<string, AdjEdge[]> }> {
  const rows = await db.ontoEdge.findMany({
    where: { organizationId, ...(linkKeys ? { linkKey: { in: linkKeys } } : {}) },
    select: { fromId: true, linkKey: true, toId: true },
    take: 50000,
  });
  return { out: buildAdjacency(rows), incoming: buildAdjacency(rows.map((r) => ({ ...r, fromId: r.toId, toId: r.fromId }))) };
}

export async function traverseLive(
  organizationId: string,
  startId: string,
  opts: { maxDepth?: number; linkKeys?: string[]; direction?: "out" | "in" | "both" } = {}
) {
  const start = await db.ontoObject.findFirst({ where: { id: startId, organizationId, deletedAt: null } });
  if (!start) return { ok: false as const, error: "unknown object" };
  const { out, incoming } = await loadAdjacency(organizationId, opts.linkKeys);
  return { ok: true as const, value: bfs(out, incoming, startId, opts) };
}
