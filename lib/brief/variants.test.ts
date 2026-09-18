import { filterLoads, mergeAnswers } from "@/lib/brief/variants";
import type { WeeklyAnswer } from "@/lib/answers/service";
import { describe, expect, it } from "vitest";

function fakeWeek(weekStart: string, margins: number[]): WeeklyAnswer {
  const lanes = margins.map((margin, i) => ({
    lane: `L${i}`,
    origin: `L${i}`,
    destination: "",
    loads: 1,
    revenue: 1000,
    cost: 1000 - margin,
    margin,
    marginPct: 50 as number | null,
    costByKind: {},
    loadKeys: [`K${i}`],
    appliedRules: [],
  }));
  const totals = {
    revenue: margins.length * 1000,
    cost: margins.length * 1000 - margins.reduce((s, m) => s + m, 0),
    margin: margins.reduce((s, m) => s + m, 0),
    marginPct: 50 as number | null,
    loads: margins.length,
  };
  return {
    lanes,
    loads: [],
    totals,
    appliedRules: [],
    adjustments: [],
    meta: { weekStart, weekEnd: weekStart, currency: "USD", distanceUnit: "miles", engineVersion: "m", dataAsOf: null },
  };
}

describe("brief variants (W5)", () => {
  it("filters loads by driver, truck, broker, and day", () => {
    const loads = [
      { driver: "Deshawn", truck: "Unit12", broker: "BlueLine", date: "2026-09-07" },
      { driver: "Vera", truck: "Unit3", broker: "RedRock", date: "2026-09-08" },
    ];
    expect(filterLoads(loads, "driver", "deshawn")).toHaveLength(1);
    expect(filterLoads(loads, "truck", "unit3")).toHaveLength(1);
    expect(filterLoads(loads, "broker", "blueline")).toHaveLength(1);
    expect(filterLoads(loads, "customer", "redrock")).toHaveLength(1);
    expect(filterLoads(loads, "day", "2026-09-08")).toHaveLength(1);
    expect(filterLoads(loads, "driver", "nobody")).toHaveLength(0);
  });

  it("merges 4 weeks into a month rollup", () => {
    const merged = mergeAnswers([
      fakeWeek("2026-09-07", [100, -50]),
      fakeWeek("2026-08-31", [200]),
    ]);
    expect(merged.totals).toMatchObject({ revenue: 3000, loads: 3, margin: 250 });
    expect(merged.lanes.find((l) => l.lane === "L0")?.loads).toBe(2);
  });
});
