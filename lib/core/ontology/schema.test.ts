import { describe, expect, it } from "vitest";
import { validateLinkInput, validateTypeInput } from "@/lib/core/ontology/schema";

describe("ontology schema (ONT-0006-0010, ONT-0031-0040)", () => {
  it("accepts a valid type", () => {
    const res = validateTypeInput({
      key: "lane",
      label: "Lane",
      properties: [{ key: "origin", label: "Origin", kind: "string", required: true }],
    });
    expect(res.ok).toBe(true);
  });
  it("rejects bad keys, dupes, reserved words", () => {
    expect(validateTypeInput({ key: "Bad Key!", label: "x" }).ok).toBe(false);
    expect(validateTypeInput({ key: "id", label: "x" }).ok).toBe(false);
    const dupe = validateTypeInput({
      key: "lane",
      label: "Lane",
      properties: [
        { key: "origin", label: "O", kind: "string" },
        { key: "origin", label: "O2", kind: "string" },
      ],
    });
    expect(dupe.ok).toBe(false);
  });
  it("rejects bad enum config", () => {
    const res = validateTypeInput({
      key: "deal",
      label: "Deal",
      properties: [{ key: "stage", label: "Stage", kind: "enum" }],
    });
    expect(res.ok).toBe(false);
  });
  it("validates links against known types", () => {
    const known = new Set(["lane", "load"]);
    expect(
      validateLinkInput({ key: "lane_loads", fromTypeKey: "lane", toTypeKey: "load", cardinality: "one-many" }, known).ok
    ).toBe(true);
    expect(
      validateLinkInput({ key: "x", fromTypeKey: "lane", toTypeKey: "ghost", cardinality: "one-many" }, known).ok
    ).toBe(false);
    expect(
      validateLinkInput({ key: "x", fromTypeKey: "lane", toTypeKey: "load", cardinality: "sideways" }, known).ok
    ).toBe(false);
  });
});
