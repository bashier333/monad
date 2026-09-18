import { describe, expect, it } from "vitest";
import { filterRecords, mergeAgencyResults } from "@/lib/packs/agency/brief/variants";
import type { AgencyResult } from "@/lib/packs/agency/engine";

function weekResult(revenue: number, cost: number, revisions: number): AgencyResult {
  const margin = Math.round((revenue - cost) * 100) / 100;
  return {
    projects: [],
    totals: { revenue, cost, margin, marginPct: revenue === 0 ? null : 0, revisions },
    appliedRules: [],
    adjustments: [],
    unmatchedRevenue: [],
  };
}

describe("agency variants (X6 E-299)", () => {
  it("filters by client/producer/day", () => {
    const rows = [
      { client: "Acme", person: "Al", date: "2026-09-07" },
      { client: "Beta", person: "Al", date: "2026-09-08" },
    ];
    expect(filterRecords(rows, "client", "acme")).toHaveLength(1);
    expect(filterRecords(rows, "producer", "al")).toHaveLength(2);
    expect(filterRecords(rows, "day", "2026-09-08")).toHaveLength(1);
  });

  it("month merge sums totals across weeks", () => {
    const m = mergeAgencyResults([weekResult(1000, 400, 3), weekResult(2000, 500, 5)]);
    expect(m.totals.revenue).toBe(3000);
    expect(m.totals.cost).toBe(900);
    expect(m.totals.margin).toBe(2100);
    expect(m.totals.revisions).toBe(8);
  });
});
