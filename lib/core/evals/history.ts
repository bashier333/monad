import { db } from "@/lib/core/db";
import type { SuiteReport } from "@/lib/core/evals/suites";

// Eval history rides on EventLog (type eval.*): suite runs, baselines and
// quarantine decisions. No extra tables; the results dataset IS this query.

export async function recordEvalRun(organizationId: string, pack: string, report: SuiteReport) {
  await db.eventLog.create({
    data: {
      type: "eval.suite-run",
      orgId: organizationId,
      pack,
      payload: {
        suiteKey: report.suiteKey,
        runs: report.runs,
        cases: report.cases,
        passed: report.passed,
        passRate: report.passRate,
        regression: report.regression,
        flaky: report.flaky,
        p50LatencyMs: report.p50LatencyMs,
        p95LatencyMs: report.p95LatencyMs,
        totalCostUsd: report.totalCostUsd,
      } as never,
      status: report.regression ? "error" : "ok",
    },
  });
}

export async function recordQuarantine(
  organizationId: string,
  pack: string,
  actorId: string,
  suiteKey: string,
  quarantined: string[],
) {
  await db.eventLog.create({
    data: {
      type: "eval.quarantine",
      orgId: organizationId,
      pack,
      payload: { suiteKey, quarantined, byId: actorId } as never,
      status: "ok",
    },
  });
}

export async function recordDisagreement(
  organizationId: string,
  pack: string,
  disagreement: { suiteKey: string; caseName: string; judgeScore: number; humanPass: boolean; byId: string; note?: string },
) {
  await db.eventLog.create({
    data: {
      type: "eval.disagreement",
      orgId: organizationId,
      pack,
      payload: { ...disagreement } as never,
      status: "ok",
    },
  });
}

export async function lastGreenBaseline(organizationId: string, suiteKey: string): Promise<number | null> {
  const rows = await db.eventLog.findMany({
    where: { orgId: organizationId, type: "eval.suite-run", status: "ok" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  for (const r of rows) {
    const p = r.payload as { suiteKey?: string; passRate?: number } | null;
    if (p?.suiteKey === suiteKey && typeof p.passRate === "number") return p.passRate;
  }
  return null;
}

export async function evalHistory(organizationId: string, suiteKey: string | null, take = 50) {
  const rows = await db.eventLog.findMany({
    where: { orgId: organizationId, type: "eval.suite-run" },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(take, 1), 200),
  });
  return rows.filter((r) => {
    if (!suiteKey) return true;
    return (r.payload as { suiteKey?: string } | null)?.suiteKey === suiteKey;
  });
}
