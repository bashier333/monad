import { z } from "zod";

// ---------------------------------------------------------------------------
// Eval suites: the release gate for everything non-deterministic. A suite
// pins target functions/agents, cases with expected outputs, judge
// functions, and pass thresholds. Suites run in CI and before every model
// or prompt change; regressions block merge. History rides on EventLog
// (type eval.*). LLM judges arrive injected — never invented.
// ---------------------------------------------------------------------------

export const EVAL_TARGET_KINDS = ["function", "agent", "formula"] as const;
export const EVAL_JUDGE_KINDS = ["exact", "tolerance", "contains", "groundedness", "llm"] as const;

const caseSchema = z.object({
  name: z.string().min(1).max(120),
  input: z.record(z.unknown()),
  expected: z.unknown(),
  tolerance: z.number().min(0).optional(),
  adversarial: z.boolean().optional(),
});

const judgeSchema = z.object({
  kind: z.enum(EVAL_JUDGE_KINDS),
  tolerance: z.number().min(0).optional(),
  threshold: z.number().min(0).max(1).optional(),
});

export const evalSuiteSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, "key must be snake_case, 2-64 chars"),
  name: z.string().min(1).max(80),
  targetKind: z.enum(EVAL_TARGET_KINDS),
  targetRef: z.string().min(1).max(120),
  cases: z.array(caseSchema).min(1).max(500),
  judge: judgeSchema,
  passRate: z.number().min(0).max(1).default(1),
  maxVariance: z.number().min(0).max(1).optional(),
});

export type EvalSuite = z.infer<typeof evalSuiteSchema>;
export type EvalCase = z.infer<typeof caseSchema>;

export function validateEvalSuite(input: unknown) {
  const parsed = evalSuiteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  return { ok: true as const, value: parsed.data };
}

export interface CaseResult {
  caseName: string;
  pass: boolean;
  score: number;
  actual: unknown;
  expected: unknown;
  latencyMs: number;
  costUsd: number;
  detail?: string;
}

export type LlmJudge = (params: { input: unknown; expected: unknown; actual: unknown }) => Promise<{ score: number; detail?: string }>;

export async function judgeCase(
  suite: EvalSuite,
  c: EvalCase,
  actual: unknown,
  llmJudge?: LlmJudge,
): Promise<CaseResult> {
  const base = { caseName: c.name, actual, expected: c.expected, latencyMs: 0, costUsd: 0 };
  switch (suite.judge.kind) {
    case "exact": {
      const pass = JSON.stringify(actual) === JSON.stringify(c.expected);
      return { ...base, pass, score: pass ? 1 : 0 };
    }
    case "tolerance": {
      const tolerance = c.tolerance ?? suite.judge.tolerance ?? 0.01;
      const e = typeof c.expected === "number" ? c.expected : Number(c.expected);
      const a = typeof actual === "number" ? actual : Number(actual);
      if (!Number.isFinite(e) || !Number.isFinite(a)) {
        return { ...base, pass: false, score: 0, detail: "tolerance judge needs numeric expected/actual" };
      }
      const pass = Math.abs(e - a) <= tolerance;
      return { ...base, pass, score: pass ? 1 : Math.max(0, 1 - Math.abs(e - a) / (Math.abs(e) || 1)) };
    }
    case "contains": {
      const pass = JSON.stringify(actual).includes(JSON.stringify(c.expected).replace(/^"|"$/g, ""));
      return { ...base, pass, score: pass ? 1 : 0 };
    }
    case "groundedness": {
      // Every cited id must exist in the provided context ids. Callers pass
      // {citedIds, contextIds} as the actual value shape.
      const v = actual as { citedIds?: unknown; contextIds?: unknown } | null;
      const cited = Array.isArray(v?.citedIds) ? (v.citedIds as unknown[]) : null;
      const context = Array.isArray(v?.contextIds) ? new Set(v.contextIds as unknown[]) : null;
      if (!cited || !context) {
        return { ...base, pass: false, score: 0, detail: "groundedness needs {citedIds, contextIds}" };
      }
      const bad = cited.filter((id) => !context.has(id));
      const pass = cited.length > 0 && bad.length === 0;
      return { ...base, pass, score: pass ? 1 : 0, detail: bad.length > 0 ? `ungrounded: ${JSON.stringify(bad)}` : undefined };
    }
    case "llm": {
      if (!llmJudge) return { ...base, pass: false, score: 0, detail: "no llm judge wired" };
      const r = await llmJudge({ input: c.input, expected: c.expected, actual });
      const threshold = suite.judge.threshold ?? 0.8;
      return { ...base, pass: r.score >= threshold, score: r.score, detail: r.detail };
    }
  }
}

export interface SuiteReport {
  suiteKey: string;
  runs: number;
  cases: number;
  passed: number;
  passRate: number;
  variance: number;
  regression: boolean;
  flaky: string[];
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalCostUsd: number;
  results: CaseResult[];
}

// Variance protocol: run each case `runs` times; a case passes when its
// mean score clears 0.5 AND its fail share stays under maxVariance.
// Flaky = passed at least once and failed at least once.
export async function runEvalSuite(
  suite: EvalSuite,
  execute: (c: EvalCase, runIndex: number) => Promise<unknown>,
  opts: { runs?: number; llmJudge?: LlmJudge; baselinePassRate?: number; costOf?: (c: EvalCase, actual: unknown) => number } = {},
): Promise<SuiteReport> {
  const runs = Math.min(Math.max(opts.runs ?? 1, 1), 25);
  const results: CaseResult[] = [];
  const flaky: string[] = [];
  let passed = 0;
  for (const c of suite.cases) {
    const scores: number[] = [];
    const latencies: number[] = [];
    let last: CaseResult | null = null;
    for (let i = 0; i < runs; i++) {
      const t0 = Date.now();
      const actual = await execute(c, i);
      const latencyMs = Date.now() - t0;
      last = await judgeCase(suite, c, actual, opts.llmJudge);
      last.latencyMs = latencyMs;
      last.costUsd = opts.costOf ? opts.costOf(c, actual) : 0;
      scores.push(last.score);
      latencies.push(latencyMs);
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const fails = scores.filter((s) => s < 0.5).length;
    const casePass = mean >= 0.5 && fails / runs <= (suite.maxVariance ?? 0);
    if (casePass) passed++;
    if (fails > 0 && fails < runs) flaky.push(c.name);
    results.push({ ...(last as CaseResult), pass: casePass, score: Math.round(mean * 1000) / 1000 });
  }
  const passRate = suite.cases.length === 0 ? 0 : passed / suite.cases.length;
  const allLat = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const pct = (p: number) => (allLat.length === 0 ? 0 : allLat[Math.min(allLat.length - 1, Math.floor((p / 100) * allLat.length))]!);
  return {
    suiteKey: suite.key,
    runs,
    cases: suite.cases.length,
    passed,
    passRate: Math.round(passRate * 1000) / 1000,
    variance: Math.round(((suite.cases.length - passed) / Math.max(suite.cases.length, 1)) * 1000) / 1000,
    regression: opts.baselinePassRate != null && passRate < opts.baselinePassRate,
    flaky,
    p50LatencyMs: pct(50),
    p95LatencyMs: pct(95),
    totalCostUsd: Math.round(results.reduce((a, r) => a + r.costUsd, 0) * 1_000_000) / 1_000_000,
    results,
  };
}

export interface ReleaseDecision {
  release: boolean;
  reasons: string[];
}

// Target comparison: run one suite against two executors (two models, two
// versions) and name the winner by pass rate, then by mean score.
export function compareReports(a: SuiteReport, b: SuiteReport): {
  winner: "a" | "b" | "tie";
  deltaPassRate: number;
} {
  const mean = (r: SuiteReport) =>
    r.results.reduce((x, y) => x + y.score, 0) / Math.max(r.results.length, 1);
  const deltaPassRate = Math.round((b.passRate - a.passRate) * 1000) / 1000;
  if (deltaPassRate !== 0) return { winner: deltaPassRate > 0 ? "b" : "a", deltaPassRate };
  const deltaMean = mean(b) - mean(a);
  if (deltaMean === 0) return { winner: "tie", deltaPassRate };
  return { winner: deltaMean > 0 ? "b" : "a", deltaPassRate };
}

// Ontology-edit scoring: policy compliance, approval acceptance and evidence
// are scored as SEPARATE dimensions (a single quality number cannot encode
// the tradeoffs — false approval costs far more than manual review).
export interface OntologyEditScore {
  policyCompliant: boolean;
  approvalAccepted: boolean;
  evidenceCited: boolean;
  dimensions: { policy: number; approval: number; evidence: number };
  pass: boolean;
}

export function scoreOntologyEdit(input: {
  policyCompliant: boolean;
  approvalAccepted: boolean;
  evidenceCited: boolean;
}): OntologyEditScore {
  const dimensions = {
    policy: input.policyCompliant ? 1 : 0,
    approval: input.approvalAccepted ? 1 : 0,
    evidence: input.evidenceCited ? 1 : 0,
  };
  // Policy is a veto dimension: a non-compliant edit never passes, however
  // well-evidenced. Approval gates execution, not scoring.
  return {
    ...input,
    dimensions,
    pass: input.policyCompliant && input.approvalAccepted,
  };
}

// Release rule: pass rate clears the suite threshold, no regression vs the
// last green baseline, and zero unquarantined flaky cases. Quarantined
// flakes are named explicitly — never silently ignored.
export function decideRelease(report: SuiteReport, suite: EvalSuite, quarantined: string[] = []): ReleaseDecision {
  const reasons: string[] = [];
  if (report.passRate < suite.passRate) {
    reasons.push(`pass rate ${report.passRate} below threshold ${suite.passRate}`);
  }
  if (report.regression) reasons.push("regression vs baseline");
  const unquarantined = report.flaky.filter((f) => !quarantined.includes(f));
  if (unquarantined.length > 0) reasons.push(`unquarantined flaky cases: ${unquarantined.join(", ")}`);
  return { release: reasons.length === 0, reasons };
}

// Deterministic case sampling (seeded mulberry32): nightly full suites,
// per-PR samples. Same seed + same cases = same sample, always.
export function sampleCases<T extends { name: string }>(cases: T[], n: number, seed: number): T[] {
  if (n >= cases.length) return [...cases];
  let s = seed >>> 0 || 1;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...cases];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  }
  return out;
}

export interface HumanLabel {
  caseName: string;
  pass: boolean;
  byId: string;
  at: string;
  note?: string;
}

// Human labels overrule judges (audited by byId+at). A label flips the case
// verdict; it never deletes the judge's score.
export function applyHumanLabels(results: CaseResult[], labels: HumanLabel[]): CaseResult[] {
  const byCase = new Map(labels.map((l) => [l.caseName, l]));
  return results.map((r) => {
    const label = byCase.get(r.caseName);
    if (!label) return r;
    return { ...r, pass: label.pass, detail: `human ${label.pass ? "pass" : "fail"} by ${label.byId}${label.note ? `: ${label.note}` : ""}` };
  });
}

export interface ReviewItem {
  caseName: string;
  reason: "failed" | "flaky" | "slow" | "costly";
  detail: string;
}

// Review queue: failures, flakes, p95-busting latencies and cost outliers
// surface for human eyes, worst first. Empty queue means nothing needs you.
export function buildReviewQueue(
  report: SuiteReport,
  opts: { slowMs?: number; costUsd?: number } = {},
): ReviewItem[] {
  const slowMs = opts.slowMs ?? 5000;
  const costUsd = opts.costUsd ?? 0.1;
  const items: ReviewItem[] = [];
  for (const r of report.results) {
    if (!r.pass) items.push({ caseName: r.caseName, reason: "failed", detail: r.detail ?? `score ${r.score}` });
    else if (report.flaky.includes(r.caseName)) items.push({ caseName: r.caseName, reason: "flaky", detail: "passed and failed across runs" });
    if (r.latencyMs > slowMs) items.push({ caseName: r.caseName, reason: "slow", detail: `${r.latencyMs}ms over ${slowMs}ms budget` });
    if (r.costUsd > costUsd) items.push({ caseName: r.caseName, reason: "costly", detail: `$${r.costUsd} over $${costUsd} budget` });
  }
  const rank = { failed: 0, flaky: 1, slow: 2, costly: 3 };
  return items.sort((a, b) => rank[a.reason] - rank[b.reason]);
}

// Quarantine manager: new flakes join; flakes green for `healAfter` straight
// reports leave. Membership is always explicit and auditable.
export function updateQuarantine(
  current: string[],
  report: SuiteReport,
  healAfter = 3,
  greenStreaks: Record<string, number> = {},
): { quarantined: string[]; streaks: Record<string, number> } {
  const inQ = new Set(current);
  for (const f of report.flaky) inQ.add(f);
  const streaks: Record<string, number> = { ...greenStreaks };
  for (const name of [...inQ]) {
    const failed = report.results.some((r) => r.caseName === name && !r.pass);
    const flakyNow = report.flaky.includes(name);
    if (!failed && !flakyNow) {
      streaks[name] = (streaks[name] ?? 0) + 1;
      if (streaks[name]! >= healAfter) {
        inQ.delete(name);
        delete streaks[name];
      }
    } else {
      streaks[name] = 0;
    }
  }
  return { quarantined: [...inQ].sort(), streaks };
}

export function resolveThreshold(suite: EvalSuite, override?: number): number {
  if (override == null) return suite.passRate;
  if (!Number.isFinite(override) || override < 0 || override > 1) {
    throw new Error("threshold override must be between 0 and 1");
  }
  return override;
}

export interface DashboardPoint {
  suiteKey: string;
  at: string;
  passRate: number;
  regression: boolean;
  p95LatencyMs: number;
  totalCostUsd: number;
  flaky: number;
}

// Metrics dashboard rollup: per-run points a chart can render directly.
// Trends, not snapshots — a single green run proves nothing.
export function dashboardPoints(
  suiteKey: string,
  runs: Array<{ at: string; report: SuiteReport }>,
): DashboardPoint[] {
  return runs.map(({ at, report }) => ({
    suiteKey,
    at,
    passRate: report.passRate,
    regression: report.regression,
    p95LatencyMs: report.p95LatencyMs,
    totalCostUsd: report.totalCostUsd,
    flaky: report.flaky.length,
  }));
}
