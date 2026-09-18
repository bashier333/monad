import {
  computeLaneMargins,
  weekBounds,
  type FeeInput,
  type FuelInput,
  type LoadInput,
} from "@/lib/margin/engine";
import { seedAliases } from "@/lib/margin/places";
import { describe, expect, it } from "vitest";

function load(o: Partial<LoadInput> & { loadKey: string }): LoadInput {
  return {
    date: "2026-09-07",
    origin: "Dallas TX",
    destination: "Houston TX",
    driver: "D",
    truck: "Unit 1",
    broker: "BlueLine",
    revenue: "1000",
    miles: "100",
    detention: "0",
    runId: "r1",
    fileName: "tms.csv",
    rowNumber: 2,
    ...o,
  };
}

const WEEK = { start: "2026-09-07", end: "2026-09-13" };

const LOADS: LoadInput[] = [
  load({ loadKey: "4821", date: "2026-09-07", origin: "Dallas TX", destination: "Houston TX", revenue: "1850", miles: "242", truck: "Unit12" }),
  load({ loadKey: "4822", date: "2026-09-08", origin: "DAL", destination: "Houston", revenue: "1725.50", detention: "150", miles: "239", truck: "Unit7" }),
  load({ loadKey: "4827", date: "2026-09-12", origin: "Phoenix AZ", destination: "El Paso TX", revenue: "1980", detention: "75", miles: "431", truck: "Unit12" }),
];

const FUELS: FuelInput[] = [
  { truck: "Unit12", date: "2026-09-07", amount: "410.20", runId: "f1", fileName: "fuel.csv", rowNumber: 2 },
  { truck: "Unit12", date: "2026-09-10", amount: "322.10", runId: "f1", fileName: "fuel.csv", rowNumber: 3 },
  { truck: "Unit7", date: "2026-09-08", amount: "335", runId: "f1", fileName: "fuel.csv", rowNumber: 4 },
];

const FEES: FeeInput[] = [
  { loadKey: "4821", fee: "55.50", runId: "b1", fileName: "broker.csv", rowNumber: 2 },
  { loadKey: "4822", fee: "51.75", runId: "b1", fileName: "broker.csv", rowNumber: 3 },
  { loadKey: "4827", fee: "59.40", runId: "b1", fileName: "broker.csv", rowNumber: 4 },
];

describe("margin engine (hand-computed)", () => {
  it("merges DAL alias and computes lane margins to the cent", () => {
    const r = computeLaneMargins(LOADS, FUELS, FEES, seedAliases(), [], WEEK.start, WEEK.end);
    expect(r.lanes).toHaveLength(2);
    const dal = r.lanes.find((l) => l.origin === "DALLAS TX");
    const phx = r.lanes.find((l) => l.origin === "PHOENIX AZ");
    expect(dal).toMatchObject({ loads: 2, revenue: 3575.5, cost: 855.57, margin: 2719.93, marginPct: 76.07 });
    expect(phx).toMatchObject({ loads: 1, revenue: 1980, cost: 603.38, margin: 1376.62, marginPct: 69.53 });
    expect(r.totals).toMatchObject({ revenue: 5555.5, cost: 1458.95, margin: 4096.55, loads: 3 });
  });

  it("excludes out-of-week records", () => {
    const r = computeLaneMargins(
      [...LOADS, load({ loadKey: "4900", date: "2026-09-20", revenue: "9999" })],
      FUELS,
      FEES,
      seedAliases(),
      [],
      WEEK.start,
      WEEK.end,
    );
    expect(r.totals.loads).toBe(3);
    expect(r.totals.revenue).toBe(5555.5);
  });

  it("applies a correction that excludes shipper-fault detention", () => {
    const r = computeLaneMargins(LOADS, FUELS, FEES, seedAliases(), [
      { id: "c1", costKind: "detention", fromLoad: "4822", toLoad: null, reason: "shipper fault" },
    ], WEEK.start, WEEK.end);
    const dal = r.lanes.find((l) => l.origin === "DALLAS TX");
    expect(dal).toMatchObject({ cost: 705.57, margin: 2869.93 });
    expect(r.adjustments).toHaveLength(1);
  });

  it("splits a cost line by percent (LOAD:60)", () => {
    const r = computeLaneMargins(LOADS, FUELS, FEES, seedAliases(), [
      { id: "c2", costKind: "detention", fromLoad: "4822", toLoad: "4821:50", reason: "shared" },
    ], WEEK.start, WEEK.end);
    expect(r.adjustments).toHaveLength(1);
    expect(r.adjustments[0].description).toContain("$75");
    const dal = r.lanes.find((l) => l.origin === "DALLAS TX");
    expect(dal?.cost).toBe(855.57);
  });

  it("is deterministic: same inputs, byte-identical outputs", () => {
    const a = computeLaneMargins(LOADS, FUELS, FEES, seedAliases(), [], WEEK.start, WEEK.end);
    const b = computeLaneMargins(LOADS, FUELS, FEES, seedAliases(), [], WEEK.start, WEEK.end);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("handles empty input without NaN or blanks", () => {
    const r = computeLaneMargins([], [], [], seedAliases(), [], WEEK.start, WEEK.end);
    expect(r.lanes).toEqual([]);
    expect(r.totals).toMatchObject({ revenue: 0, cost: 0, margin: 0, marginPct: null, loads: 0 });
  });

  it("computes Mon–Sun week bounds", () => {
    expect(weekBounds("2026-09-09", 1)).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });
});
