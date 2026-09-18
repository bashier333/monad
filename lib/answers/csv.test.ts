import { buildExportCSV } from "@/lib/answers/csv";
import type { LaneMargin, LoadMargin } from "@/lib/margin/engine";
import { describe, expect, it } from "vitest";

const LANES: LaneMargin[] = [
  { lane: "A → B", origin: "A", destination: "B", loads: 1, revenue: 100, cost: 40, margin: 60, marginPct: 60, costByKind: { fuel: 40 }, loadKeys: ["L1"], appliedRules: [] },
];
const LOADS: LoadMargin[] = [
  { loadKey: "L1", date: "2026-09-07", origin: "A", destination: "B", driver: "D", truck: "T", broker: "B", revenue: 100, miles: 50, costs: [{ kind: "fuel", label: "Fuel", amount: 40, ruleId: "R-fuel-1", source: { runId: "r", fileName: "f.csv", rowNumbers: [2] } }], totalCost: 40, margin: 60, marginPct: 60 },
];

describe("buildExportCSV (W1)", () => {
  it("emits lane + load sections with source pins", () => {
    const csv = buildExportCSV(LANES, LOADS, null);
    expect(csv).toContain("lane,origin,destination,loads,revenue,cost,margin,margin_pct");
    expect(csv).toContain("A → B,A,B,1,100,40,60,60");
    expect(csv).toContain("L1,2026-09-07,A,B,D,T,100,50,40,60,fuel,Fuel,40,R-fuel-1,f.csv,2");
  });

  it("filters by lane and escapes hostile cells", () => {
    const evil: LoadMargin[] = [{ ...LOADS[0], loadKey: "=cmd|x", driver: 'a"b' }];
    const csv = buildExportCSV(LANES, evil, "NOPE");
    expect(csv).not.toContain("L1,");
    const csv2 = buildExportCSV(LANES, evil, null);
    expect(csv2).toContain("'=cmd|x");
    expect(csv2).toContain('"a""b"');
  });
});
