import { describe, expect, it } from "vitest";
import { computeProjectMargins, type AgencyInput } from "@/lib/packs/agency/engine";
import { computeLaneMargins, type LoadInput } from "@/lib/packs/freight/margin/engine";
import { seedAliases } from "@/lib/packs/freight/margin/places";
import { linearForecast } from "@/lib/core/predict";

describe("predict integration (R-141 wired into engines)", () => {
  it("agency engine output feeds a forecast without NaN", () => {
    const records: AgencyInput[] = [];
    for (let i = 0; i < 3; i++) {
      records.push({
        recordKey: `R${i}`,
        date: `2026-09-0${i + 7}`,
        project: "P",
        client: "",
        person: "Al",
        task: "edit",
        hours: "5",
        rate: "100",
        revenue: "",
        runId: "run",
        fileName: "t.csv",
        rowNumber: i + 2,
      });
    }
    const r = computeProjectMargins(records, [], [], [], new Map(), [], "2026-09-07", "2026-09-13");
    const history = [{ weekStart: "2026-08-31", margin: r.totals.margin - 100 }, { weekStart: "2026-09-07", margin: r.totals.margin }];
    const f = linearForecast(history);
    expect(Number.isNaN(f.point)).toBe(false);
  });

  it("freight engine output feeds a forecast without NaN", () => {
    const loads: LoadInput[] = [
      { loadKey: "L1", date: "2026-09-07", origin: "Dallas TX", destination: "Houston TX", driver: "", truck: "", broker: "", revenue: "1000", miles: "150", detention: "0", runId: "r", fileName: "t.csv", rowNumber: 2 },
    ];
    const r = computeLaneMargins(loads, [], [], seedAliases(), [], "2026-09-07", "2026-09-13");
    const history = [{ weekStart: "2026-08-31", margin: r.totals.margin - 50 }, { weekStart: "2026-09-07", margin: r.totals.margin }];
    const f = linearForecast(history);
    expect(Number.isNaN(f.point)).toBe(false);
  });
});
