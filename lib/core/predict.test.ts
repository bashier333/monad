import { describe, expect, it } from "vitest";
import { linearForecast, forecastBands, backtestForecast, mape, explainForecast, computeLearnedThresholds, capAnomalies } from "@/lib/core/predict";

function agencyHistory(): Array<{ weekStart: string; margin: number }> {
  const out: Array<{ weekStart: string; margin: number }> = [];
  for (let i = 8; i >= 1; i--) {
    out.push({ weekStart: `2026-07-${String(7 + (8 - i)).padStart(2, "0")}`, margin: 1000 + (8 - i) * 100 });
  }
  return out;
}

describe("predict (R-141–R-143, R-149)", () => {
  it("forecasts next week with bands from a rising trend", () => {
    const f = linearForecast(agencyHistory());
    expect(f.point).toBeGreaterThan(1000 + 7 * 100);
    const bands = forecastBands(f, agencyHistory());
    expect(bands.lo).toBeLessThan(f.point);
    expect(bands.high).toBeGreaterThan(f.point);
    expect(bands.band).toBeGreaterThanOrEqual(0);
  });

  it("explains the prediction with drivers", () => {
    const f = linearForecast(agencyHistory());
    const e = explainForecast(f, agencyHistory());
    expect(e.drivers.join(" ")).toMatch(/trend|volatility/);
    expect(e.explanation.length).toBeGreaterThan(0);
  });

  it("backtest: MAPE tracked over history, never NaN", () => {
    const m = backtestForecast(agencyHistory());
    expect(Number.isNaN(m)).toBe(false);
    expect(m).toBeGreaterThanOrEqual(0);
    expect(mape([{ point: 100, actual: 100 }])).toBe(0);
  });

  it("degrades on flat/short history", () => {
    const f = linearForecast([{ weekStart: "2026-09-07", margin: 500 }]);
    expect(f.point).toBe(500);
    const flat = linearForecast([
      { weekStart: "2026-09-07", margin: 500 },
      { weekStart: "2026-09-14", margin: 500 },
    ]);
    expect(flat.slope).toBe(0);
  });
});

describe("anomaly ML-lite (R-151/R-153/R-154/R-155)", () => {
  it("learned thresholds from history (2σ, floor 3)", () => {
    const t = computeLearnedThresholds([
      { group: "A", marginPct: 10, margin: 0, cost: 0, costByKind: {} },
      { group: "A", marginPct: 14, margin: 0, cost: 0, costByKind: {} },
      { group: "A", marginPct: 6, margin: 0, cost: 0, costByKind: {} },
    ]);
    expect(t["A"]).toBeGreaterThanOrEqual(3);
  });

  it("fatigue guard caps anomalies per week and digests the rest", () => {
    const flags = Array.from({ length: 9 }, (_, i) => ({ lane: `L${i}`, swingPts: 10, direction: "up" as const, causes: [] }));
    const capped = capAnomalies(flags, 5);
    expect(capped.anomalies).toHaveLength(5);
    expect(capped.digestNote).toMatch(/4 more/);
  });
});
