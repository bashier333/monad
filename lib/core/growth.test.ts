import { describe, expect, it } from "vitest";
import { churnRisk, pqlScore, roiEstimate } from "@/lib/core/growth";

describe("growth scoring (R-803/R-806/R-862)", () => {
  it("PQL at 60+ with reasons", () => {
    expect(pqlScore({ answers: 0, uploads: 0, corrections: 0, daysSinceFirstAnswer: null }).pql).toBe(false);
    const hot = pqlScore({ answers: 6, uploads: 2, corrections: 1, daysSinceFirstAnswer: 0 });
    expect(hot.pql).toBe(true);
    expect(hot.score).toBe(100);
    expect(hot.reasons.length).toBeGreaterThan(0);
  });

  it("churn risk tiers", () => {
    expect(churnRisk({ answers: 0, uploads: 0, corrections: 0, daysSinceFirstAnswer: null, daysSinceLastAnswer: null }).risk).toBe("high");
    expect(churnRisk({ answers: 5, uploads: 2, corrections: 1, daysSinceFirstAnswer: 0, daysSinceLastAnswer: 20 }).risk).toBe("high");
    expect(churnRisk({ answers: 5, uploads: 2, corrections: 1, daysSinceFirstAnswer: 0, daysSinceLastAnswer: 10 }).risk).toBe("medium");
    expect(churnRisk({ answers: 5, uploads: 2, corrections: 1, daysSinceFirstAnswer: 0, daysSinceLastAnswer: 2 }).risk).toBe("low");
  });

  it("ROI estimate pays back in days", () => {
    const r = roiEstimate({ hoursPerWeekManual: 4, hourlyRate: 75, reworkCostPerWeek: 200, teamPricePerMonth: 499 });
    expect(r.monthlySavings).toBeGreaterThan(499);
    expect(r.paybackDays).toBeLessThan(30);
    expect(r.summary).toMatch(/\$/);
  });
});
