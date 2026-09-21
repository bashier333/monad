import { describe, expect, it } from "vitest";
import { evaluateRule, metricValue, validateAlertRule } from "@/lib/core/workflow";

describe("manufacturing coverage alerts (MFG-0402)", () => {
  it("validates the coverage metric for the manufacturing pack", () => {
    const base = { owner: "planner", responseAction: "transfer stock", windowMinutes: 120 };
    const ok = validateAlertRule({ metric: "coverage", op: "<", threshold: 7, channel: "inapp", pack: "manufacturing", ...base });
    expect(ok.ok).toBe(true);
    const bad = validateAlertRule({ metric: "coverage", op: "<", threshold: 7, channel: "inapp", pack: "freight", ...base });
    expect(bad.ok).toBe(false);
  });

  it("keeps margin|cost validation unchanged", () => {
    const base = { owner: "planner", responseAction: "review", windowMinutes: 120 };
    expect(validateAlertRule({ metric: "margin", op: ">", threshold: 0, channel: "email", pack: "freight", ...base }).ok).toBe(true);
    expect(validateAlertRule({ metric: "profit", op: ">", threshold: 0, channel: "email", pack: "freight", ...base }).ok).toBe(false);
  });

  it("evaluates coverage thresholds with missing coverage treated as infinite", () => {
    expect(metricValue("coverage", { key: "a", margin: 0, cost: 0, coverage: 3 })).toBe(3);
    expect(metricValue("coverage", { key: "a", margin: 0, cost: 0 })).toBe(Number.POSITIVE_INFINITY);
    const hits = evaluateRule(
      { metric: "coverage", op: "<", threshold: 7, channel: "inapp", pack: "manufacturing", owner: "p", responseAction: "t", windowMinutes: 60 },
      [
        { key: "lot-low", margin: 0, cost: 0, coverage: 3 },
        { key: "lot-ok", margin: 0, cost: 0, coverage: 12 },
        { key: "lot-unknown", margin: 0, cost: 0 },
      ]
    );
    expect(hits).toEqual(["lot-low"]);
  });
});
