import { db, txSerializable } from "@/lib/core/db";
import { Prisma } from "@prisma/client";
import {
  asOf,
  buildCheckpointPayload,
  findOverlaps,
  GENESIS_CUMULATIVE,
  hashEvent,
  type CheckpointPayload,
  type Fact,
} from "@/lib/core/ontology/temporal";

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function recordFact(
  organizationId: string,
  objectId: string,
  input: { property: string; value: unknown; validFrom: string; validTo?: string | null; reason?: string; sourceRunId?: string }
) {
  const object = await db.ontoObject.findFirst({ where: { id: objectId, organizationId, deletedAt: null } });
  if (!object) return { ok: false as const, error: "unknown object" };
  const from = new Date(input.validFrom);
  if (Number.isNaN(from.getTime())) return { ok: false as const, error: "bad validFrom" };
  const to = input.validTo ? new Date(input.validTo) : null;
  if (to && Number.isNaN(to.getTime())) return { ok: false as const, error: "bad validTo" };
  if (to && to <= from) return { ok: false as const, error: "validTo must be after validFrom" };
  const created = await db.ontoFact.create({
    data: {
      organizationId,
      objectId,
      property: input.property,
      value: json(input.value),
      validFrom: from,
      validTo: to,
      sourceRunId: input.sourceRunId,
      reason: input.reason ?? "",
    },
  });
  return { ok: true as const, value: created };
}

export async function readAsOf(organizationId: string, objectId: string, at: string) {
  const object = await db.ontoObject.findFirst({ where: { id: objectId, organizationId, deletedAt: null } });
  if (!object) return { ok: false as const, error: "unknown object" };
  const rows = await db.ontoFact.findMany({
    where: { organizationId, objectId },
    orderBy: { txnAt: "asc" },
    take: 5000,
  });
  const facts: Fact[] = rows.map((r) => ({
    property: r.property,
    value: r.value,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo ? r.validTo.toISOString() : null,
    txnAt: r.txnAt.toISOString(),
  }));
  return { ok: true as const, value: asOf(facts, at) };
}

export async function checkOverlaps(organizationId: string, objectId: string) {
  const rows = await db.ontoFact.findMany({
    where: { organizationId, objectId },
    orderBy: { validFrom: "asc" },
    take: 5000,
  });
  return findOverlaps(
    rows.map((r) => ({
      id: r.id,
      property: r.property,
      value: r.value,
      validFrom: r.validFrom.toISOString(),
      validTo: r.validTo ? r.validTo.toISOString() : null,
      txnAt: r.txnAt.toISOString(),
    }))
  );
}

export async function recordEvent(
  organizationId: string,
  input: { kind: string; objectId?: string; actorId: string; before?: unknown; after?: unknown }
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Chain-write is transactional with serializable isolation so concurrent
      // writers cannot both anchor to the same prevHash and fork the chain.
      return await db.$transaction(
        async (tx) => {
          const last = await tx.ontoEvent.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
          });
          const prevHash = last?.hash ?? "";
          const createdAt = new Date();
          const hash = hashEvent({
            kind: input.kind,
            objectId: input.objectId ?? "",
            actorId: input.actorId,
            before: input.before ?? null,
            after: input.after ?? null,
            prevHash,
            createdAt: createdAt.toISOString(),
          });
          const created = await tx.ontoEvent.create({
            data: {
              organizationId,
              kind: input.kind,
              objectId: input.objectId ?? "",
              actorId: input.actorId,
              before: json(input.before ?? null),
              after: json(input.after ?? null),
              prevHash,
              hash,
              createdAt,
            },
          });
          return { ok: true as const, value: created };
        },
        txSerializable()
      );
    } catch (e) {
      lastError = e;
      const code = (e as { code?: string }).code;
      if (code !== "P2034") break;
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)));
    }
  }
  return { ok: false as const, error: `event chain write failed: ${lastError instanceof Error ? lastError.message : String(lastError)}` };
}

function isCheckpointPayload(v: unknown): v is CheckpointPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.eventCount === "number" &&
    typeof o.headHash === "string" &&
    typeof o.prevCumulative === "string" &&
    typeof o.cumulative === "string"
  );
}

// Anchor the chain: commits an audit.checkpoint event recording the current
// head hash plus a cumulative anchor chained to the previous checkpoint.
// The event count is read-committed (approximate under concurrent writes) —
// exactness comes from verifyTail/verifyEventChain recomputation, not from
// trusting this number.
export async function writeCheckpoint(organizationId: string, actorId: string) {
  const [last, prev] = await Promise.all([
    db.ontoEvent.findFirst({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    db.ontoEvent.findFirst({
      where: { organizationId, kind: "audit.checkpoint" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!last) return { ok: false as const, error: "no events to anchor" };
  const prevPayload = isCheckpointPayload(prev?.after) ? (prev!.after as CheckpointPayload) : null;
  const prevCumulative = prevPayload?.cumulative ?? GENESIS_CUMULATIVE;
  const since = prev?.createdAt;
  const eventCount = await db.ontoEvent.count({
    where: { organizationId, ...(since ? { createdAt: { gt: since } } : {}) },
  });
  const payload = buildCheckpointPayload(prevCumulative, last.hash, eventCount, new Date().toISOString(), last.id);
  return recordEvent(organizationId, { kind: "audit.checkpoint", actorId, after: payload });
}

// Incremental verification: re-verify only the tail segment after the latest
// checkpoint instead of replaying from genesis. Falls back to full verify
// when no checkpoint exists or the anchor head is outside the read window.
// Security statement, stated plainly: checkpoints make RECENT verification
// O(segment); a full-history pass is still required periodically because a
// tampered checkpoint payload is itself only caught by the main chain walk.
export async function verifyTail(
  organizationId: string,
  take = 10000
): Promise<{ ok: boolean; checked: number; checkpointId: string | null; brokenAt: string | null }> {
  const checkpoint = await db.ontoEvent.findFirst({
    where: { organizationId, kind: "audit.checkpoint" },
    orderBy: { createdAt: "desc" },
  });
  if (!checkpoint || !isCheckpointPayload(checkpoint.after)) {
    const full = await verifyEventChain(organizationId, take);
    return { ...full, checkpointId: null };
  }
  const payload = checkpoint.after as CheckpointPayload;
  // The anchor is loaded by id — never by timestamp window — so createdAt
  // ties between the anchor and the checkpoint event cannot misplace it.
  const [anchor, tail] = await Promise.all([
    db.ontoEvent.findFirst({ where: { id: payload.anchorId, organizationId } }),
    // gte, not gt: same-millisecond events after the checkpoint must be in
    // the window. The checkpoint + anchor rows are skipped by id in the walk.
    db.ontoEvent.findMany({
      where: { organizationId, createdAt: { gte: checkpoint.createdAt } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take,
    }),
  ]);
  if (!anchor || anchor.hash !== payload.headHash) {
    const full = await verifyEventChain(organizationId, take);
    return { ...full, checkpointId: null };
  }
  // Recompute the anchor itself first: a checkpoint that points at a
  // rewritten event must fail here, not silently anchor to it.
  const anchorExpected = hashEvent({
    kind: anchor.kind,
    objectId: anchor.objectId,
    actorId: anchor.actorId,
    before: anchor.before,
    after: anchor.after,
    prevHash: anchor.prevHash,
    createdAt: anchor.createdAt.toISOString(),
  });
  if (anchor.hash !== anchorExpected) {
    return { ok: false, checked: 0, checkpointId: checkpoint.id, brokenAt: anchor.id };
  }
  // Walk by linkage (prevHash → event), never by timestamp order: same-ms
  // events sort arbitrarily by cuid, so (createdAt, id) order is NOT chain
  // order. Falling off the window edge means truncation, not a break.
  const byPrev = new Map<string, (typeof tail)[number]>();
  for (const r of tail) {
    // The checkpoint event itself is an ordinary chained event and must be
    // verified like any other — only the anchor (already consumed as the
    // walk start) is skipped.
    if (r.id === anchor.id) continue;
    if (!byPrev.has(r.prevHash)) byPrev.set(r.prevHash, r);
  }
  let prevHash = anchor.hash;
  let checked = 0;
  for (;;) {
    const next = byPrev.get(prevHash);
    if (!next) break;
    const expected = hashEvent({
      kind: next.kind,
      objectId: next.objectId,
      actorId: next.actorId,
      before: next.before,
      after: next.after,
      prevHash,
      createdAt: next.createdAt.toISOString(),
    });
    if (next.hash !== expected) {
      return { ok: false, checked, checkpointId: checkpoint.id, brokenAt: next.id };
    }
    byPrev.delete(prevHash);
    prevHash = next.hash;
    checked++;
  }
  if (tail.length >= take) {
    // Window may be truncated mid-segment — only a full pass can conclude.
    const full = await verifyEventChain(organizationId, take);
    return { ...full, checkpointId: null };
  }
  return { ok: true, checked, checkpointId: checkpoint.id, brokenAt: null };
}

export async function verifyEventChain(
  organizationId: string,
  take = 10000
): Promise<{ ok: boolean; checked: number; brokenAt: string | null }> {
  const rows = await db.ontoEvent.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
  });
  let prevHash = "";
  for (const r of rows) {
    const expected = hashEvent({
      kind: r.kind,
      objectId: r.objectId,
      actorId: r.actorId,
      before: r.before,
      after: r.after,
      prevHash,
      createdAt: r.createdAt.toISOString(),
    });
    if (r.prevHash !== prevHash || r.hash !== expected) {
      return { ok: false, checked: rows.length, brokenAt: r.id };
    }
    prevHash = r.hash;
  }
  return { ok: true, checked: rows.length, brokenAt: null };
}
