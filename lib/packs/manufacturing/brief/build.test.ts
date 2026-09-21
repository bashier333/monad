import { describe, expect, it } from "vitest";
import { buildMfgBrief, buildMfgBriefVariants } from "@/lib/packs/manufacturing/brief/build";
import type { TwinOverview } from "@/lib/packs/manufacturing/service";
import { validatePackManifest } from "@/lib/packs/manifest";
import { MANUFACTURING_MANIFEST } from "@/lib/packs/manufacturing/manifest";

function overview(): TwinOverview {
  return {
    counts: { plants: 2, warehouses: 2, products: 3, lots: 3, shipments: 2, customers: 2 },
    coverage: [
      { id: "l1", key: "wh-1-sku-a", coverageDays: 4, belowReorderPoint: true },
      { id: "l2", key: "wh-2-sku-b", coverageDays: 12, belowReorderPoint: false },
      { id: "l3", key: "wh-1-sku-c", coverageDays: null, belowReorderPoint: false },
    ],
    reorder: [{ lotId: "l1", lotKey: "wh-1-sku-a", shortage: 60, suggestedFromId: "w2", suggestedFromKey: "wh-2", available: 150 }],
    risks: [
      {
        shipmentId: "s1",
        shipmentKey: "sh-1",
        qty: 500,
        customers: ["c1"],
        customerLabels: ["Cust A"],
        plants: ["p1"],
        plantLabels: ["Plant One"],
      },
    ],
    shipments: [{ id: "s1", key: "sh-1", status: "delayed", eta: "2026-09-19T18:00:00Z" }],
    atRiskLots: 1,
    delayedShipments: 1,
  };
}

describe("manufacturing manifest (MFG-0110)", () => {
  it("validates against the pack manifest schema", () => {
    expect(validatePackManifest(MANUFACTURING_MANIFEST)).toEqual([]);
  });
});

describe("manufacturing weekly brief (MFG-0210)", () => {
  it("builds sentences from computed signals", () => {
    const b = buildMfgBrief(overview(), "2026-09-14", "2026-09-20");
    expect(b.parts[0]).toContain("Week of 2026-09-14");
    expect(b.parts.some((p) => p.includes("Average coverage 8"))).toBe(true);
    expect(b.parts.some((p) => p.includes("1 reorder suggestion"))).toBe(true);
    expect(b.parts.some((p) => p.includes("1 delayed shipment"))).toBe(true);
    expect(b.coverage.atRiskLots).toBe(1);
    expect(b.risk.exposedQty).toBe(500);
  });

  it("stays honest when there are no signals", () => {
    const o = overview();
    o.coverage = o.coverage.map((c) => ({ ...c, coverageDays: null, belowReorderPoint: false }));
    o.reorder = [];
    o.risks = [];
    o.delayedShipments = 0;
    const b = buildMfgBrief(o, "2026-09-14", "2026-09-20");
    expect(b.parts[b.parts.length - 1]).toBe("No coverage or risk signals this week.");
  });

  it("builds region variant explanations", () => {
    const b = buildMfgBrief(overview(), "2026-09-14", "2026-09-20");
    const v = buildMfgBriefVariants(
      overview(),
      b,
      [
        { id: "p1", type: "plant", label: "Plant One", region: "midwest" },
        { id: "c1", type: "customer", label: "Cust A", region: "east" },
      ]
    );
    expect(v.variants.map((x) => x.key)).toEqual(["midwest", "east"]);
    expect(v.variants[0]!.note).toContain("midwest:");
  });
});
