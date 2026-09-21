import { describe, expect, it } from "vitest";
import {
  asOf,
  buildCheckpointPayload,
  checkpointHash,
  findGaps,
  findOverlaps,
  GENESIS_CUMULATIVE,
  hashEvent,
  verifyChain,
} from "@/lib/core/ontology/temporal";

const FACTS = [
  { property: "status", value: "active", validFrom: "2026-01-01", validTo: "2026-06-01", txnAt: "2026-01-02" },
  { property: "status", value: "idle", validFrom: "2026-06-01", validTo: null, txnAt: "2026-06-02" },
  { property: "rate", value: 100, validFrom: "2026-01-01", validTo: null, txnAt: "2026-01-02" },
];

describe("ontology temporal (ONT-0301-0320, ONT-0341-0355)", () => {
  it("reads point-in-time state", () => {
    expect(asOf(FACTS, "2026-03-01")).toEqual({ status: "active", rate: 100 });
    expect(asOf(FACTS, "2026-07-01")).toEqual({ status: "idle", rate: 100 });
    expect(asOf(FACTS, "2025-01-01")).toEqual({});
  });
  it("prefers later transactions for the same validity", () => {
    const dup = [
      ...FACTS,
      { property: "rate", value: 120, validFrom: "2026-01-01", validTo: null, txnAt: "2026-02-01" },
    ];
    expect(asOf(dup, "2026-03-01").rate).toBe(120);
  });
  it("detects overlapping ranges", () => {
    const rows = [
      { id: "a", property: "status", value: 1, validFrom: "2026-01-01", validTo: "2026-06-01", txnAt: "2026-01-01" },
      { id: "b", property: "status", value: 2, validFrom: "2026-05-01", validTo: null, txnAt: "2026-05-02" },
      { id: "c", property: "rate", value: 3, validFrom: "2026-05-01", validTo: null, txnAt: "2026-05-02" },
    ];
    expect(findOverlaps(rows)).toEqual([["a", "b"]]);
  });
  it("finds coverage gaps", () => {
    const rows = [
      { id: "a", property: "status", value: 1, validFrom: "2026-02-01", validTo: "2026-03-01", txnAt: "2026-02-01" },
    ];
    expect(findGaps(rows, "2026-01-01", "2026-04-01")).toEqual([
      { property: "status", gapFrom: "2026-01-01", gapTo: "2026-02-01" },
      { property: "status", gapFrom: "2026-03-01", gapTo: "2026-04-01" },
    ]);
  });
  it("builds chained checkpoint payloads (MFG-0501)", () => {
    const first = buildCheckpointPayload(GENESIS_CUMULATIVE, "head-1", 100, "2026-01-01", "evt-1");
    expect(first.prevCumulative).toBe("genesis");
    expect(first.anchorId).toBe("evt-1");
    expect(first.cumulative).toBe(checkpointHash("genesis", "head-1", 100));
    const second = buildCheckpointPayload(first.cumulative, "head-2", 40, "2026-01-02", "evt-2");
    expect(second.prevCumulative).toBe(first.cumulative);
    expect(second.cumulative).not.toBe(first.cumulative);
    // Tampering with any input changes the anchor.
    expect(checkpointHash(first.cumulative, "head-X", 40)).not.toBe(second.cumulative);
  });
  it("hashes and verifies event chains", () => {
    const h1 = hashEvent({ kind: "create", objectId: "o1", actorId: "u1", before: null, after: { a: 1 }, prevHash: "", createdAt: "2026-01-01" });
    const h2 = hashEvent({ kind: "update", objectId: "o1", actorId: "u1", before: { a: 1 }, after: { a: 2 }, prevHash: h1, createdAt: "2026-01-02" });
    expect(verifyChain([{ hash: h1, prevHash: "" }, { hash: h2, prevHash: h1 }])).toEqual({ ok: true });
    expect(verifyChain([{ hash: h1, prevHash: "" }, { hash: h2, prevHash: "tampered" }])).toEqual({ ok: false, breakAt: 1 });
  });
});
