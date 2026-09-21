import { describe, expect, it } from "vitest";
import { coverageDays, lotCoverage } from "@/lib/packs/manufacturing/logic/coverage";

describe("manufacturing coverage days (MFG-0201)", () => {
  it("divides qty by daily demand", () => {
    expect(coverageDays(100, 10)).toBe(10);
    expect(coverageDays(55, 10)).toBe(5.5);
  });

  it("clamps at zero and handles no demand", () => {
    expect(coverageDays(0, 10)).toBe(0);
    expect(coverageDays(-5, 10)).toBe(0);
    expect(coverageDays(50, 0)).toBe(Infinity);
    expect(coverageDays(0, 0)).toBe(0);
  });

  it("returns null on non-finite input", () => {
    expect(coverageDays(Number.NaN, 10)).toBeNull();
    expect(coverageDays(10, Number.NaN)).toBeNull();
  });
});

describe("lot coverage (MFG-0202)", () => {
  it("flags lots below the reorder point", () => {
    const r = lotCoverage({ qty_on_hand: 40, reorder_point: 50, daily_demand: 10 });
    expect(r.belowReorderPoint).toBe(true);
    expect(r.coverageDays).toBe(4);
  });

  it("passes lots above the reorder point", () => {
    const r = lotCoverage({ qty_on_hand: 90, reorder_point: 50, daily_demand: 10 });
    expect(r.belowReorderPoint).toBe(false);
    expect(r.coverageDays).toBe(9);
  });

  it("handles lots without demand or reorder data", () => {
    const r = lotCoverage({ qty_on_hand: 90 });
    expect(r.coverageDays).toBeNull();
    expect(r.belowReorderPoint).toBe(false);
  });
});
