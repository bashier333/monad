import { describe, expect, it } from "vitest";
import { diffBranches, threeWayMerge } from "@/lib/core/ontology/branches";

const base = new Map([
  ["a", { version: 1, data: { x: 1 } }],
  ["b", { version: 1, data: { x: 2 } }],
]);

describe("ontology branches (ONT-0801-0820)", () => {
  it("applies clean changes", () => {
    const main = new Map(base);
    const out = threeWayMerge(base, main, [{ objectId: "a", baseVersion: 1, data: { x: 10 } }]);
    expect(out).toEqual({ applied: ["a"], conflicts: [] });
  });
  it("flags main-side edits as conflicts", () => {
    const main = new Map([
      ["a", { version: 2, data: { x: 5 } }],
      ["b", { version: 1, data: { x: 2 } }],
    ]);
    const out = threeWayMerge(base, main, [{ objectId: "a", baseVersion: 1, data: { x: 10 } }]);
    expect(out.applied).toEqual([]);
    expect(out.conflicts[0]!.objectId).toBe("a");
  });
  it("accepts identical edits and reports deletions", () => {
    const main = new Map([
      ["a", { version: 2, data: { x: 10 } }],
      ["b", { version: 1, data: { x: 2 } }],
    ]);
    const out = threeWayMerge(base, main, [{ objectId: "a", baseVersion: 1, data: { x: 10 } }]);
    expect(out.applied).toEqual(["a"]);
    const missing = threeWayMerge(base, new Map([["b", { version: 1, data: { x: 2 } }]]), [
      { objectId: "a", baseVersion: 1, data: { x: 10 } },
    ]);
    expect(missing.conflicts[0]!.reason).toBe("deleted on main");
  });
  it("diffs branch against base", () => {
    const branch = new Map([
      ["a", { version: 2, data: {} }],
      ["c", { version: 1, data: {} }],
    ]);
    expect(diffBranches(base, branch)).toEqual({ added: ["c"], modified: ["a"], deleted: ["b"] });
  });
});
