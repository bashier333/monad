import { describe, expect, it } from "vitest";
import { applyVisibility, clearanceForRole, rankOf, RESTRICTED_TOKEN } from "@/lib/packs/manufacturing/service";

function row(id: string, typeKey: string, data: Record<string, unknown>) {
  return { id, key: id, typeKey, version: 1, data };
}

describe("marking ranks and role clearance (MFG-0701)", () => {
  it("ranks unknown markings as internal", () => {
    expect(rankOf("internal")).toBe(0);
    expect(rankOf("confidential")).toBe(1);
    expect(rankOf("restricted")).toBe(2);
    expect(rankOf(undefined)).toBe(0);
    expect(rankOf("top-secret")).toBe(0);
  });

  it("maps roles to clearance", () => {
    expect(clearanceForRole("OWNER")).toBe("restricted");
    expect(clearanceForRole("DISPATCHER")).toBe("confidential");
    expect(clearanceForRole("VIEWER")).toBe("internal");
    expect(clearanceForRole("anything-else")).toBe("internal");
  });
});

describe("applyVisibility (MFG-0702)", () => {
  const rows = [
    row("a", "mfg_shipment", { status: "delayed" }),
    row("b", "mfg_shipment", { status: "delayed", marking: "confidential" }),
    row("c", "mfg_shipment", { status: "delayed", marking: "restricted" }),
    row("d", "mfg_product", { sku: "SKU-A", unit_value: 2.5 }),
    row("e", "mfg_product", { sku: "SKU-B", unit_value: 3.1, marking: "confidential" }),
  ];

  it("sees everything without options (back-compat)", () => {
    expect(applyVisibility(rows).map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("drops rows above clearance", () => {
    expect(applyVisibility(rows, { clearance: "confidential" }).map((r) => r.id)).toEqual(["a", "b", "d", "e"]);
    expect(applyVisibility(rows, { clearance: "internal" }).map((r) => r.id)).toEqual(["a", "d"]);
  });

  it("masks sensitive fields below max clearance", () => {
    const [d] = applyVisibility(rows, { clearance: "confidential" }).filter((r) => r.id === "d");
    expect(d!.data.unit_value).toBe(RESTRICTED_TOKEN);
    const [full] = applyVisibility(rows, { clearance: "restricted" }).filter((r) => r.id === "d");
    expect(full!.data.unit_value).toBe(2.5);
  });

  it("does not mutate the input rows", () => {
    applyVisibility(rows, { clearance: "internal" });
    expect(rows[3]!.data.unit_value).toBe(2.5);
  });
});
