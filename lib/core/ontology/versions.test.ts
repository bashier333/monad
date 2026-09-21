import { describe, expect, it } from "vitest";
import { checkCardinality, diffTypeSnapshots, planMigration } from "@/lib/core/ontology/versions";

const base = {
  key: "load",
  label: "Load",
  plural: "Loads",
  description: "",
  properties: [
    { key: "revenue", label: "Revenue", kind: "number", required: true, unique: false, indexed: true, immutable: false },
  ],
};

describe("ontology versions (ONT-0041-0055)", () => {
  it("diffs added, removed, changed", () => {
    const next = {
      ...base,
      properties: [
        { key: "revenue", label: "Revenue", kind: "string", required: true, unique: false, indexed: true, immutable: false },
        { key: "miles", label: "Miles", kind: "number", required: false, unique: false, indexed: false, immutable: false },
      ],
    };
    const diff = diffTypeSnapshots(base, next);
    expect(diff.added).toEqual(["miles"]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([{ key: "revenue", fields: ["kind"] }]);
  });
  it("detects removals", () => {
    const diff = diffTypeSnapshots(base, { ...base, properties: [] });
    expect(diff.removed).toEqual(["revenue"]);
  });
  it("plans destructive and safe steps", () => {
    const plan = planMigration({ added: ["miles"], removed: ["old"], changed: [{ key: "revenue", fields: ["kind"] }] });
    expect(plan.find((s) => s.op === "add_property")?.destructive).toBe(false);
    expect(plan.find((s) => s.op === "drop_property")?.destructive).toBe(true);
    expect(plan.find((s) => s.op === "alter_property")?.destructive).toBe(true);
  });
  it("enforces one-one cardinality", () => {
    expect(checkCardinality("one-one", 1).ok).toBe(false);
    expect(checkCardinality("one-one", 0).ok).toBe(true);
    expect(checkCardinality("one-many", 99).ok).toBe(true);
  });
});
