import { describe, expect, it } from "vitest";
import {
  applyHumanLabels,
  buildReviewQueue,
  compareReports,
  dashboardPoints,
  decideRelease,
  judgeCase,
  resolveThreshold,
  runEvalSuite,
  sampleCases,
  scoreOntologyEdit,
  updateQuarantine,
  validateEvalSuite,
  type EvalSuite,
} from "@/lib/core/evals/suites";
import {
  exportAutomation,
  importAutomationEnvelope,
  scenarioAutomationSpec,
  weeklyReportSpec,
} from "@/lib/core/automations/templates";

// Evals engine proof (I suite→results topics) + H-tail builders: judges,
// variance, comparison, release rule, templates, envelopes.

const SUITE = {
  key: "margin_math",
  name: "Margin math",
  targetKind: "formula",
  targetRef: "margin_rollup",
  cases: [
    { name: "basic", input: { revenue: 1000, cost: 400 }, expected: 600 },
    { name: "zero", input: { revenue: 0, cost: 0 }, expected: 0 },
  ],
  judge: { kind: "exact" },
  passRate: 1,
} as unknown as EvalSuite;

const exec = (table: Record<string, unknown>) => async (c: { input: Record<string, unknown> }) => {
  const k = JSON.stringify(c.input);
  if (k in table) return table[k];
  const { revenue, cost } = c.input as { revenue: number; cost: number };
  return revenue - cost;
};

describe("validateEvalSuite", () => {
  it("accepts well-formed suites, rejects empties and bad judges", () => {
    expect(validateEvalSuite(SUITE).ok).toBe(true);
    expect(validateEvalSuite({ ...SUITE, cases: [] }).ok).toBe(false);
    expect(validateEvalSuite({ ...SUITE, key: "Bad" }).ok).toBe(false);
    expect(validateEvalSuite({ ...SUITE, judge: { kind: "teleport" } }).ok).toBe(false);
  });
});

describe("judgeCase kinds", () => {
  it("exact compares bytes", async () => {
    expect((await judgeCase(SUITE, SUITE.cases[0]!, 600)).pass).toBe(true);
    expect((await judgeCase(SUITE, SUITE.cases[0]!, 601)).pass).toBe(false);
  });
  it("tolerance scores closeness", async () => {
    const suite = { ...SUITE, judge: { kind: "tolerance", tolerance: 2 } } as EvalSuite;
    const c = { name: "t", input: {}, expected: 100 };
    expect((await judgeCase(suite, c, 101)).pass).toBe(true);
    expect((await judgeCase(suite, c, 200)).pass).toBe(false);
    expect((await judgeCase(suite, c, "nope")).detail).toMatch(/numeric/);
  });
  it("contains matches serialized substrings", async () => {
    const suite = { ...SUITE, judge: { kind: "contains" } } as EvalSuite;
    expect((await judgeCase(suite, { name: "c", input: {}, expected: "DAL" }, "DAL-HOU")).pass).toBe(true);
  });
  it("groundedness requires citations inside context", async () => {
    const suite = { ...SUITE, judge: { kind: "groundedness" } } as EvalSuite;
    const c = { name: "g", input: {}, expected: null };
    expect((await judgeCase(suite, c, { citedIds: ["a"], contextIds: ["a", "b"] })).pass).toBe(true);
    expect((await judgeCase(suite, c, { citedIds: [], contextIds: ["a"] })).pass).toBe(false);
    expect((await judgeCase(suite, c, { citedIds: ["ghost"], contextIds: ["a"] })).detail).toMatch(/ungrounded/);
    expect((await judgeCase(suite, c, {})).pass).toBe(false);
  });
  it("llm judge needs a wired judge and honors thresholds", async () => {
    const suite = { ...SUITE, judge: { kind: "llm", threshold: 0.8 } } as EvalSuite;
    const c = { name: "l", input: {}, expected: "x" };
    expect((await judgeCase(suite, c, "x")).detail).toMatch(/no llm judge/);
    expect((await judgeCase(suite, c, "x", async () => ({ score: 0.9 }))).pass).toBe(true);
    expect((await judgeCase(suite, c, "x", async () => ({ score: 0.5 }))).pass).toBe(false);
  });
});

describe("runEvalSuite variance + regression + flaky", () => {
  it("perfect runs report 1.0 with no flakes", async () => {
    const r = await runEvalSuite(SUITE, exec({}));
    expect(r).toMatchObject({ cases: 2, passed: 2, passRate: 1, regression: false });
    expect(r.flaky).toEqual([]);
  });
  it("failing cases and baselines trip regression honestly", async () => {
    const r = await runEvalSuite(SUITE, exec({ '{"revenue":1000,"cost":400}': 0 }));
    expect(r.passed).toBe(1);
    expect(r.passRate).toBe(0.5);
    const withBase = await runEvalSuite(SUITE, exec({ '{"revenue":1000,"cost":400}': 0 }), { baselinePassRate: 1 });
    expect(withBase.regression).toBe(true);
  });
  it("intermittent cases quarantine by name, never vanish", async () => {
    const counts = new Map<string, number>();
    const alternating = async (c: { name: string; input: Record<string, unknown> }) => {
      if (c.name !== "basic") return 0;
      const k = (counts.get(c.name) ?? 0) + 1;
      counts.set(c.name, k);
      return k % 2 === 0 ? 600 : 0;
    };
    const r = await runEvalSuite({ ...SUITE, maxVariance: 1 }, alternating, { runs: 4 });
    expect(r.flaky).toEqual(["basic"]);
    expect(r.passed).toBe(2);
  });
});

describe("compareReports + ontology edits + release", () => {
  it("names winners by pass rate, then mean score, else tie", async () => {
    const a = await runEvalSuite(SUITE, exec({}));
    const b = await runEvalSuite(SUITE, exec({ '{"revenue":1000,"cost":400}': 0 }));
    expect(compareReports(a, b)).toMatchObject({ winner: "a" });
    expect(compareReports(b, a).winner).toBe("b");
    expect(compareReports(a, a).winner).toBe("tie");
  });
  it("scores policy/approval/evidence as separate dimensions with policy veto", () => {
    expect(scoreOntologyEdit({ policyCompliant: true, approvalAccepted: true, evidenceCited: true }).pass).toBe(true);
    expect(scoreOntologyEdit({ policyCompliant: false, approvalAccepted: true, evidenceCited: true }).pass).toBe(false);
    expect(scoreOntologyEdit({ policyCompliant: true, approvalAccepted: false, evidenceCited: true }).pass).toBe(false);
  });
  it("release needs threshold + no regression + no unquarantined flakes", async () => {
    const green = await runEvalSuite(SUITE, exec({}));
    expect(decideRelease(green, SUITE, [])).toMatchObject({ release: true, reasons: [] });
    const bad = await runEvalSuite({ ...SUITE, passRate: 1 }, exec({ '{"revenue":1000,"cost":400}': 0 }), { baselinePassRate: 1 });
    const dec = decideRelease(bad, { ...SUITE, passRate: 1 }, []);
    expect(dec.release).toBe(false);
    expect(dec.reasons.join(" ")).toMatch(/below threshold|regression/);
    const counts = new Map<string, number>();
    const alternating = async (c: { name: string; input: Record<string, unknown> }) => {
      if (c.name !== "basic") return 0;
      const k = (counts.get(c.name) ?? 0) + 1;
      counts.set(c.name, k);
      return k % 2 === 0 ? 600 : 0;
    };
    const flaky = await runEvalSuite({ ...SUITE, maxVariance: 1 }, alternating, { runs: 4 });
    expect(decideRelease(flaky, { ...SUITE, passRate: 0 }, []).release).toBe(false);
    expect(decideRelease(flaky, { ...SUITE, passRate: 0 }, ["basic"]).release).toBe(true);
  });
});

describe("latency + cost capture", () => {
  it("records per-case latency and aggregates cost", async () => {
    const r = await runEvalSuite(SUITE, exec({}), { costOf: () => 0.002 });
    expect(r.results.every((x) => x.latencyMs >= 0)).toBe(true);
    expect(r.totalCostUsd).toBeCloseTo(0.004);
    expect(r.p50LatencyMs).toBeGreaterThanOrEqual(0);
    expect(r.p95LatencyMs).toBeGreaterThanOrEqual(r.p50LatencyMs);
  });
});

describe("sampling is deterministic", () => {
  const cases = [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }];
  it("same seed gives same sample; full take returns all", () => {
    expect(sampleCases(cases, 2, 7)).toEqual(sampleCases(cases, 2, 7));
    expect(sampleCases(cases, 2, 7)).not.toEqual(sampleCases(cases, 2, 8));
    expect(sampleCases(cases, 10, 1)).toHaveLength(4);
  });
});

describe("human labels overrule judges, audited", () => {
  it("flips verdicts with byId + note, keeps scores", async () => {
    const r = await runEvalSuite(SUITE, exec({ '{"revenue":1000,"cost":400}': 0 }));
    const labeled = applyHumanLabels(r.results, [
      { caseName: "basic", pass: true, byId: "u1", at: "2026-09-21", note: "verified against ledger" },
    ]);
    expect(labeled.find((x) => x.caseName === "basic")).toMatchObject({ pass: true, score: 0 });
    expect(labeled.find((x) => x.caseName === "basic")!.detail).toMatch(/u1/);
    expect(labeled.find((x) => x.caseName === "zero")!.detail).toBeUndefined();
  });
});

describe("review queue surfaces worst first", () => {
  it("orders failed > flaky > slow > costly", async () => {
    const r = await runEvalSuite(SUITE, exec({ '{"revenue":1000,"cost":400}': 0 }), { costOf: () => 5 });
    const q = buildReviewQueue(r, { slowMs: -1, costUsd: -1 });
    expect(q[0]!.reason).toBe("failed");
    expect(q.map((x) => x.reason)).toContain("costly");
    expect(buildReviewQueue(await runEvalSuite(SUITE, exec({}))).filter((x) => x.reason === "failed")).toEqual([]);
  });
});

describe("quarantine manager heals and holds", () => {
  it("adds flakes, heals after N green streaks, holds the rest", async () => {
    const counts = new Map<string, number>();
    const alternating = async (c: { name: string; input: Record<string, unknown> }) => {
      if (c.name !== "basic") return 0;
      const k = (counts.get(c.name) ?? 0) + 1;
      counts.set(c.name, k);
      return k % 2 === 0 ? 600 : 0;
    };
    const r = await runEvalSuite({ ...SUITE, maxVariance: 1 }, alternating, { runs: 4 });
    const q1 = updateQuarantine([], r);
    expect(q1.quarantined).toEqual(["basic"]);
    const green = await runEvalSuite(SUITE, exec({}));
    const q2 = updateQuarantine(q1.quarantined, green, 3, q1.streaks);
    expect(q2.quarantined).toEqual(["basic"]);
    expect(q2.streaks.basic).toBe(1);
    const q3 = updateQuarantine(q2.quarantined, green, 1, q2.streaks);
    expect(q3.quarantined).toEqual([]);
  });
});

describe("thresholds + dashboard points", () => {
  it("overrides validate; points chart directly", async () => {
    expect(resolveThreshold(SUITE)).toBe(1);
    expect(resolveThreshold(SUITE, 0.8)).toBe(0.8);
    expect(() => resolveThreshold(SUITE, 2)).toThrow(/between 0 and 1/);
    const r = await runEvalSuite(SUITE, exec({}));
    const pts = dashboardPoints("margin_math", [{ at: "2026-09-21", report: r }]);
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ suiteKey: "margin_math", passRate: 1, regression: false, flaky: 0 });
  });
});

describe("H-tail builders", () => {
  it("weekly report fires Monday 7am with notify + fallback", () => {
    const s = weeklyReportSpec();
    expect(s.trigger).toMatchObject({ kind: "schedule", cron: "0 7 * * MON" });
    expect(s.effects.map((e) => e.kind)).toEqual(["function", "notify", "fallback"]);
    expect(weeklyReportSpec("FRI").trigger).toMatchObject({ cron: "0 7 * * FRI" });
  });
  it("scenario specs key safely and validate", () => {
    const s = scenarioAutomationSpec("West Region!", "impact_sim");
    expect(s.key).toBe("scenario_west_region_");
    expect(s.effects[0]).toMatchObject({ kind: "function", functionKey: "impact_sim" });
  });
  it("automation envelopes round-trip and reject foreigners", () => {
    const env = exportAutomation(weeklyReportSpec());
    expect(env.format).toBe("monad-automation/1");
    const back = importAutomationEnvelope(JSON.parse(JSON.stringify(env)));
    expect(back.ok).toBe(true);
    expect(importAutomationEnvelope({ format: "other/1" }).ok).toBe(false);
    expect(importAutomationEnvelope({ format: "monad-automation/1", automation: { key: "Bad!" } }).ok).toBe(false);
  });
});
