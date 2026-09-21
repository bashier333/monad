import { createHash } from "node:crypto";

export interface Fact {
  property: string;
  value: unknown;
  validFrom: string;
  validTo: string | null;
  txnAt: string;
}

export function asOf(facts: Fact[], at: string): Record<string, unknown> {
  const point = new Date(at).getTime();
  const state: Record<string, unknown> = {};
  const latestTxn: Record<string, number> = {};
  for (const f of facts) {
    const from = new Date(f.validFrom).getTime();
    const to = f.validTo ? new Date(f.validTo).getTime() : Infinity;
    if (point < from || point >= to) continue;
    const txn = new Date(f.txnAt).getTime();
    if (txn > (latestTxn[f.property] ?? -Infinity)) {
      latestTxn[f.property] = txn;
      state[f.property] = f.value;
    }
  }
  return state;
}

export interface RangeFact extends Fact {
  id: string;
}

export function findOverlaps(facts: RangeFact[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const byProp = new Map<string, RangeFact[]>();
  for (const f of facts) {
    const list = byProp.get(f.property) ?? [];
    list.push(f);
    byProp.set(f.property, list);
  }
  for (const list of byProp.values()) {
    const sorted = [...list].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      const prevTo = prev.validTo ?? "9999-12-31";
      if (cur.validFrom < prevTo) pairs.push([prev.id, cur.id]);
    }
  }
  return pairs;
}

export interface CoverageGap {
  property: string;
  gapFrom: string;
  gapTo: string;
}

export function findGaps(facts: RangeFact[], rangeFrom: string, rangeTo: string): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const byProp = new Map<string, RangeFact[]>();
  for (const f of facts) {
    const list = byProp.get(f.property) ?? [];
    list.push(f);
    byProp.set(f.property, list);
  }
  for (const [property, list] of byProp) {
    const sorted = [...list].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    let cursor = rangeFrom;
    for (const f of sorted) {
      if (f.validFrom > cursor) {
        gaps.push({ property, gapFrom: cursor, gapTo: f.validFrom < rangeTo ? f.validFrom : rangeTo });
      }
      const to = f.validTo ?? rangeTo;
      if (to > cursor) cursor = to < rangeTo ? to : rangeTo;
    }
    if (cursor < rangeTo) gaps.push({ property, gapFrom: cursor, gapTo: rangeTo });
  }
  return gaps;
}

export function hashEvent(payload: { kind: string; objectId: string; actorId: string; before: unknown; after: unknown; prevHash: string; createdAt: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([payload.prevHash, payload.kind, payload.objectId, payload.actorId, payload.before ?? null, payload.after ?? null, payload.createdAt]))
    .digest("hex");
}

export function verifyChain(hashes: Array<{ hash: string; prevHash: string }>): { ok: boolean; breakAt?: number } {
  for (let i = 0; i < hashes.length; i++) {
    const expected = i === 0 ? "" : hashes[i - 1]!.hash;
    if (hashes[i]!.prevHash !== expected) return { ok: false, breakAt: i };
  }
  return { ok: true };
}

// Checkpoint anchors (R-3): a checkpoint commits {eventCount, headHash,
// prevCumulative, cumulative} where cumulative = sha256 over the three.
// Checkpoints are ordinary chained events, so tampering with one breaks the
// main chain (detectable by full verify). Their value is incremental
// verification: re-verify only the tail segment after the latest checkpoint
// instead of replaying history from genesis every time.
export interface CheckpointPayload {
  eventCount: number;
  headHash: string;
  // Database id of the head event. verifyTail loads the anchor by id, so
  // the segment walk never depends on createdAt-tie ordering to find it.
  anchorId: string;
  prevCumulative: string;
  cumulative: string;
  checkpointAt: string;
}

export const GENESIS_CUMULATIVE = "genesis";

export function checkpointHash(prevCumulative: string, headHash: string, eventCount: number): string {
  return createHash("sha256").update(`${prevCumulative}|${headHash}|${eventCount}`).digest("hex");
}

export function buildCheckpointPayload(
  prevCumulative: string,
  headHash: string,
  eventCount: number,
  checkpointAt: string,
  anchorId: string
): CheckpointPayload {
  return {
    eventCount,
    headHash,
    anchorId,
    prevCumulative,
    cumulative: checkpointHash(prevCumulative, headHash, eventCount),
    checkpointAt,
  };
}
