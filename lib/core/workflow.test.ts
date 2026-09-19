import { describe, expect, it } from "vitest";
import { computeLearnedThresholds, capAnomalies } from "@/lib/core/predict";
import {
  evaluateRule,
  executePlaybookSteps,
  STARTER_PLAYBOOKS,
  validateAlertRule,
  validatePlaybookSteps,
  type PlaybookStep,
} from "@/lib/core/workflow";

describe("workflow engine (R-041–R-049)", () => {
  it("validates alert rules", () => {
    expect(validateAlertRule({ metric: "margin", op: "<", threshold: 0, channel: "inapp" }).ok).toBe(true);
    expect(validateAlertRule({ metric: "nope", op: "<", threshold: 0, channel: "inapp" }).ok).toBe(false);
    expect(validateAlertRule({ metric: "margin", op: "<", threshold: 0, channel: "pigeon" }).ok).toBe(false);
  });

  it("evaluates alert rules against groups", () => {
    const rule = validateAlertRule({ metric: "margin", op: "<", threshold: 100, channel: "inapp" });
    if (!rule.ok) throw new Error("rule");
    const hits = evaluateRule(rule.value, [
      { key: "GOOD", margin: 500, cost: 100 },
      { key: "BAD", margin: -200, cost: 700 },
    ]);
    expect(hits).toEqual(["BAD"]);
  });

  it("validates playbook steps + 5 starter playbooks", () => {
    expect(validatePlaybookSteps([{ type: "brief", params: {} }]).ok).toBe(true);
    expect(validatePlaybookSteps([{ type: "pigeon", params: {} }]).ok).toBe(false);
    expect(validatePlaybookSteps([]).ok).toBe(false);
    expect(STARTER_PLAYBOOKS).toHaveLength(5);
    for (const pb of STARTER_PLAYBOOKS) {
      expect(validatePlaybookSteps(pb.steps).ok).toBe(true);
      expect(pb.schedule).toMatch(/\d/);
    }
  });

  it("dry-run previews effects without executing (pure executor)", async () => {
    const steps: PlaybookStep[] = [{ type: "brief", params: {} }, { type: "notify", params: { message: "hi" } }];
    const executed: string[] = [];
    const executors = {
      brief: async () => {
        executed.push("brief");
        return "brief:ok";
      },
      notify: async (m: string) => {
        executed.push("notify");
        return `notify:${m}`;
      },
      export: async () => {
        executed.push("export");
        return "export:ok";
      },
    };
    const dry = await executePlaybookSteps(steps, true, executors);
    expect(dry.status).toBe("dry_run");
    expect(executed).toEqual([]);
    expect(dry.log).toHaveLength(2);

    const real = await executePlaybookSteps(steps, false, executors);
    expect(real.status).toBe("ok");
    expect(executed).toEqual(["brief", "notify"]);
    expect(real.log[0].result).toBe("brief:ok");
  });
});

describe("anomaly-lite wiring (R-151/R-153)", () => {
  it("learned thresholds + fatigue guard compose", () => {
    const t = computeLearnedThresholds([
      { key: "A", marginPct: 10, margin: 0, cost: 0, costByKind: {} },
      { key: "A", marginPct: 11, margin: 0, cost: 0, costByKind: {} },
      { key: "A", marginPct: 12, margin: 0, cost: 0, costByKind: {} },
    ]);
    expect(t["A"]).toBeGreaterThanOrEqual(3);
    const flags = Array.from({ length: 7 }, (_, i) => ({ lane: `L${i}` }));
    expect(capAnomalies(flags, 5).anomalies).toHaveLength(5);
  });
});
