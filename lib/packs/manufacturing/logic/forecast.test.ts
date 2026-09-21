import { describe, expect, it } from "vitest";
import { demandForecast } from "@/lib/packs/manufacturing/logic/forecast";

describe("demand forecast (MFG-0205)", () => {
  it("returns null with fewer than two weeks", () => {
    expect(demandForecast([{ weekStart: "2026-09-07", demand: 10 }])).toBeNull();
    expect(demandForecast([])).toBeNull();
  });

  it("forecasts rising demand", () => {
    const f = demandForecast([
      { weekStart: "2026-08-31", demand: 100 },
      { weekStart: "2026-09-07", demand: 110 },
      { weekStart: "2026-09-14", demand: 120 },
    ]);
    expect(f).not.toBeNull();
    expect(f!.slope).toBeGreaterThan(0);
    expect(f!.point).toBeGreaterThanOrEqual(120);
    expect(f!.weeks).toBe(3);
    expect(f!.bands.high).toBeGreaterThanOrEqual(f!.point);
    expect(f!.explanation.length).toBeGreaterThan(0);
  });

  it("forecasts flat demand stably", () => {
    const f = demandForecast([
      { weekStart: "2026-08-31", demand: 50 },
      { weekStart: "2026-09-07", demand: 50 },
      { weekStart: "2026-09-14", demand: 50 },
    ]);
    expect(f!.point).toBeCloseTo(50, 5);
  });
});
