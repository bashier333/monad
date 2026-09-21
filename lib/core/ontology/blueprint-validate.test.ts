import { describe, expect, it } from "vitest";
import { validateBlueprint } from "@/lib/core/ontology/blueprint-validate";

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    version: 2,
    exportedAt: "2026-09-20T00:00:00.000Z",
    counts: { types: 1, links: 1, actions: 1, policies: 1 },
    types: [
      {
        key: "mfg_plant",
        label: "Plant",
        properties: [{ key: "name", label: "Name", kind: "string", required: true, unique: false }],
      },
    ],
    links: [{ key: "mfg_supplies", fromTypeKey: "mfg_warehouse", toTypeKey: "mfg_plant", cardinality: "many-many" }],
    actions: [{ key: "mfg_transfer", targetTypeKey: "mfg_plant", approvalPolicy: "single", effects: [{ kind: "set" }] }],
    policies: [{ typeKey: "mfg_plant", effect: "allow", field: "", op: "neq", value: null, priority: 0 }],
    ...overrides,
  } as never;
}

describe("blueprint validation L0+L1 (MFG-0802)", () => {
  it("accepts a coherent blueprint", () => {
    const base = manifest({
      types: [
        {
          key: "mfg_plant",
          label: "Plant",
          properties: [{ key: "name", label: "Name", kind: "string", required: true, unique: false }],
        },
        { key: "mfg_warehouse", label: "Warehouse", properties: [] },
      ],
    });
    expect(validateBlueprint(base)).toEqual({ ok: true, problems: [] });
  });
  it("rejects bad versions, keys, and duplicates (L0)", () => {
    const bad = manifest({
      version: 99,
      exportedAt: "not-a-date",
      types: [
        { key: "Bad Key!", label: "x", properties: [{ key: "", label: "", kind: "", required: false, unique: false }] },
        { key: "mfg_plant", label: "a", properties: [] },
        { key: "mfg_plant", label: "b", properties: [] },
      ],
      links: [{ key: "l", fromTypeKey: "mfg_plant", toTypeKey: "mfg_plant", cardinality: "sideways" }],
      actions: [{ key: "a", targetTypeKey: "mfg_plant", approvalPolicy: "maybe", effects: [] }],
      policies: [{ typeKey: "mfg_plant", effect: "sometimes", field: "", op: "eq", value: 1, priority: 0 }],
    });
    const res = validateBlueprint(bad);
    expect(res.ok).toBe(false);
    expect(res.problems.some((p) => p.level === "L0" && p.path === "version")).toBe(true);
    expect(res.problems.some((p) => p.message.includes("duplicate type key"))).toBe(true);
    expect(res.problems.some((p) => p.message.includes("cardinality"))).toBe(true);
    expect(res.problems.some((p) => p.message.includes("approvalPolicy"))).toBe(true);
    expect(res.problems.some((p) => p.message.includes("allow|deny"))).toBe(true);
  });
  it("rejects dangling references (L1)", () => {
    const res = validateBlueprint(
      manifest({
        links: [{ key: "l", fromTypeKey: "ghost", toTypeKey: "mfg_plant", cardinality: "one-many" }],
        actions: [{ key: "a", targetTypeKey: "ghost", approvalPolicy: "none", effects: [{ kind: "set" }] }],
        policies: [{ typeKey: "ghost", effect: "allow", field: "", op: "neq", value: null, priority: 0 }],
      })
    );
    expect(res.ok).toBe(false);
    const paths = res.problems.filter((p) => p.level === "L1").map((p) => p.path);
    expect(paths).toContain("links.l");
    expect(paths).toContain("actions.a");
    expect(paths).toContain("policies.ghost");
  });
});
