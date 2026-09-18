import { applyCorrectionsToRecords, type CostedRecord } from "@/lib/core/corrections/apply";
import { describe, expect, it } from "vitest";

function rec(key: string, amounts: number[]): CostedRecord & { key: string } {
  return {
    key,
    costs: amounts.map((amount, i) => ({
      kind: i === 0 ? "labor" : "fee",
      label: i === 0 ? "Labor" : "Fee",
      amount,
      ruleId: "R-x",
      source: { runId: "r", fileName: "f", rowNumbers: [2] },
    })),
  };
}

describe("applyCorrectionsToRecords (core)", () => {
  it("moves a full line between records", () => {
    const m = new Map([["A", rec("A", [100])], ["B", rec("B", [50])]]);
    const adj = applyCorrectionsToRecords(m, [{ id: "c1", costKind: "labor", fromLoad: "A", toLoad: "B", reason: "x" }]);
    expect(adj).toHaveLength(1);
    expect(m.get("A")?.costs).toHaveLength(0);
    expect(m.get("B")?.costs).toHaveLength(2);
  });

  it("splits by percent and excludes", () => {
    const m = new Map([["A", rec("A", [100])], ["B", rec("B", [50])]]);
    applyCorrectionsToRecords(m, [{ id: "c1", costKind: "labor", fromLoad: "A", toLoad: "B:40", reason: "" }]);
    expect(m.get("A")?.costs.map((c) => c.amount)).toEqual([60]);
    const m2 = new Map([["A", rec("A", [100])]]);
    const adj = applyCorrectionsToRecords(m2, [{ id: "c2", costKind: "labor", fromLoad: "A", toLoad: null, reason: "y" }]);
    expect(m2.get("A")?.costs).toHaveLength(0);
    expect(adj[0].description).toContain("excluded");
  });

  it("ignores unknown targets, kinds, and bad shares", () => {
    const m = new Map([["A", rec("A", [100])]]);
    const adj = applyCorrectionsToRecords(m, [
      { id: "c1", costKind: "nope", fromLoad: "A", toLoad: "B", reason: "" },
      { id: "c2", costKind: "labor", fromLoad: "ZZZ", toLoad: "B", reason: "" },
      { id: "c3", costKind: "labor", fromLoad: "A", toLoad: "B:999", reason: "" },
    ]);
    expect(adj).toEqual([]);
    expect(m.get("A")?.costs).toHaveLength(1);
  });
});
