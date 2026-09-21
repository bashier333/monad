import { describe, expect, it } from "vitest";
import { impactSimulation } from "@/lib/packs/manufacturing/logic/impact";
import type { LotLite } from "@/lib/packs/manufacturing/logic/reorder";

function lot(id: string, qty: number, reorder: number, dailyDemand: number): LotLite {
  return { id, key: id, data: { qty_on_hand: qty, reorder_point: reorder, daily_demand: dailyDemand } };
}

describe("impact simulation (MFG-0206)", () => {
  const lots: LotLite[] = [lot("lot-a", 40, 50, 10), lot("lot-b", 200, 50, 10)];

  it("computes before and after snapshots", () => {
    const r = impactSimulation(lots, [{ objectId: "lot-a", data: { qty_on_hand: 500 } }]);
    expect(r.before.atRisk).toBe(1);
    expect(r.after.atRisk).toBe(0);
    expect(r.affected).toBe(1);
    expect(r.before.avgCoverage).toBe(12);
    expect(r.after.avgCoverage).toBeGreaterThan(r.before.avgCoverage!);
  });

  it("ignores changes for unknown objects", () => {
    const r = impactSimulation(lots, [{ objectId: "nope", data: { qty_on_hand: 500 } }]);
    expect(r.affected).toBe(0);
    expect(r.after.atRisk).toBe(r.before.atRisk);
  });

  it("does not mutate the input lots", () => {
    impactSimulation(lots, [{ objectId: "lot-a", data: { qty_on_hand: 500 } }]);
    expect(lots[0]!.data.qty_on_hand).toBe(40);
  });
});
