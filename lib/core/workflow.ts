import { weekBounds } from "@/lib/core/dates";
import { db } from "@/lib/core/db";
import { notifyOrg } from "@/lib/core/notify";
import { logger } from "@/lib/core/logger";
import { capAnomalies, computeLearnedThresholds, type SummaryGroupLite } from "@/lib/core/predict";
import { sendEmail, unsubscribeUrl } from "@/lib/core/email";

export interface AlertRuleInput {
  metric: string;
  op: string;
  threshold: number;
  channel: string;
  pack?: string;
  owner?: string;
  responseAction?: string;
  windowMinutes?: number;
}

export function validateAlertRule(body: AlertRuleInput): { ok: true; value: Required<AlertRuleInput> } | { ok: false; error: string } {
  if (!["margin", "cost", "coverage"].includes(body.metric)) return { ok: false, error: "metric must be margin|cost|coverage" };
  if (!["<", ">"].includes(body.op)) return { ok: false, error: "op must be < or >" };
  if (!Number.isFinite(body.threshold)) return { ok: false, error: "threshold must be a number" };
  if (!["inapp", "email"].includes(body.channel)) return { ok: false, error: "channel must be inapp|email" };
  const pack = body.pack === "agency" ? "agency" : body.pack === "manufacturing" ? "manufacturing" : "freight";
  if (body.metric === "coverage" && pack !== "manufacturing") {
    return { ok: false, error: "coverage metric is only valid for the manufacturing pack" };
  }
  // EEMUA rationalization: owner + action + window are required so a rule is
  // an alarm with a documented response, not FYI noise.
  const owner = String(body.owner ?? "").trim();
  if (!owner) return { ok: false, error: "owner is required (who responds)" };
  if (owner.length > 120) return { ok: false, error: "owner must be 120 chars or fewer" };
  const responseAction = String(body.responseAction ?? "").trim();
  if (!responseAction) return { ok: false, error: "responseAction is required (what the owner must do)" };
  if (responseAction.length > 500) return { ok: false, error: "responseAction must be 500 chars or fewer" };
  const windowMinutes = body.windowMinutes === undefined ? 1440 : Number(body.windowMinutes);
  if (!Number.isInteger(windowMinutes) || windowMinutes < 5 || windowMinutes > 10080) {
    return { ok: false, error: "windowMinutes must be an integer between 5 and 10080" };
  }
  return { ok: true, value: { metric: body.metric, op: body.op, threshold: body.threshold, channel: body.channel, pack, owner, responseAction, windowMinutes } };
}

export interface GroupLite {
  key: string;
  margin: number;
  cost: number;
  coverage?: number;
}

export function metricValue(metric: string, g: GroupLite): number {
  if (metric === "coverage") return typeof g.coverage === "number" ? g.coverage : Number.POSITIVE_INFINITY;
  return metric === "margin" ? g.margin : g.cost;
}

export function evaluateRule(rule: Required<AlertRuleInput>, groups: GroupLite[]): string[] {
  const hits: string[] = [];
  for (const g of groups) {
    const value = metricValue(rule.metric, g);
    if (rule.op === "<" && value < rule.threshold) hits.push(g.key);
    if (rule.op === ">" && value > rule.threshold) hits.push(g.key);
  }
  return hits;
}

export interface PlaybookStep {
  type: "brief" | "notify" | "export";
  params: Record<string, string>;
}

export function validatePlaybookSteps(steps: unknown): { ok: true; steps: PlaybookStep[] } | { ok: false; error: string } {
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, error: "steps required" };
  const out: PlaybookStep[] = [];
  for (const s of steps) {
    const step = s as { type?: string; params?: Record<string, string> };
    if (!step.type || !["brief", "notify", "export"].includes(step.type)) {
      return { ok: false, error: "every step needs type brief|notify|export" };
    }
    out.push({ type: step.type as PlaybookStep["type"], params: step.params ?? {} });
  }
  return { ok: true, steps: out };
}

export const STARTER_PLAYBOOKS: Array<{ name: string; steps: PlaybookStep[]; schedule: string }> = [
  { name: "Monday brief + notify", steps: [{ type: "brief", params: {} }, { type: "notify", params: { message: "Monday brief is ready" } }], schedule: "0 7 * * MON" },
  { name: "Weekly export", steps: [{ type: "export", params: {} }], schedule: "0 8 * * MON" },
  { name: "Studio brief + notify", steps: [{ type: "brief", params: { pack: "agency" } }, { type: "notify", params: { message: "Studio brief is ready" } }], schedule: "5 7 * * MON" },
  { name: "Month-end export", steps: [{ type: "export", params: {} }], schedule: "0 9 1 * *" },
  { name: "Friday flash", steps: [{ type: "brief", params: {} }, { type: "notify", params: { message: "Week closing — check losers" } }], schedule: "0 16 * * FRI" },
];

export async function evaluateAlerts(
  orgId: string,
  pack: string,
  weekStartsOn: number,
  anchor: string,
  getGroups: () => Promise<GroupLite[]>,
): Promise<{ fired: Array<{ ruleId: string; groups: string[] }> }> {
  const rules = await db.alertRule.findMany({ where: { orgId, active: true, pack } });
  if (rules.length === 0) return { fired: [] };
  const groups = await getGroups();
  const fired: Array<{ ruleId: string; groups: string[] }> = [];
  for (const r of rules) {
    const parsed = validateAlertRule({
      metric: r.metric,
      op: r.op,
      threshold: r.threshold,
      channel: r.channel,
      pack,
      owner: r.owner,
      responseAction: r.responseAction,
      windowMinutes: r.windowMinutes,
    });
    if (!parsed.ok) continue;
    const hits = evaluateRule(parsed.value, groups);
    if (hits.length === 0) continue;
    fired.push({ ruleId: r.id, groups: hits });
    // The alert carries its rationalization: who owns it, what to do, and
    // the response window — so the notification is actionable, not FYI.
    const label = `${parsed.value.metric} ${parsed.value.op} ${parsed.value.threshold}: ${hits.slice(0, 5).join(", ")}${hits.length > 5 ? ` +${hits.length - 5}` : ""} — owner ${parsed.value.owner}, respond within ${parsed.value.windowMinutes}m: ${parsed.value.responseAction}`;
    if (parsed.value.channel === "inapp") {
      await notifyOrg(orgId, "alert", label, "/answers");
    } else {
      const members = await db.membership.findMany({ where: { organizationId: orgId }, include: { user: { select: { id: true, email: true, emailOptOut: true } } } });
      const { start } = weekBounds(anchor, weekStartsOn);
      for (const m of members) {
        if (!m.user.email || m.user.emailOptOut) continue;
        const html = `<p>Alert for week of ${start}: ${label}</p><p><a href="${unsubscribeUrl("https://app", m.user.id)}">Unsubscribe</a></p>`;
        await sendEmail(m.user.email, `Margin alert — week of ${start}`, html, "alerts");
      }
    }
    void logger;
  }
  return { fired };
}

export async function executePlaybookSteps(
  steps: PlaybookStep[],
  dryRun: boolean,
  executors: { brief: () => Promise<string>; notify: (message: string) => Promise<string>; export: () => Promise<string> },
  retries = 1,
): Promise<{ status: string; log: Array<{ step: PlaybookStep; result: string }> }> {
  const log: Array<{ step: PlaybookStep; result: string }> = [];
  for (const step of steps) {
    if (dryRun) {
      log.push({ step, result: "dry-run: would execute" });
      continue;
    }
    let result: string | null = null;
    for (let attempt = 0; attempt <= retries && result === null; attempt++) {
      try {
        result =
          step.type === "brief"
            ? await executors.brief()
            : step.type === "notify"
              ? await executors.notify(step.params.message ?? "playbook step")
              : await executors.export();
      } catch (e) {
        if (attempt >= retries) result = `failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    log.push({ step, result: result ?? "failed: unknown" });
  }
  const failed = log.some((l) => l.result.startsWith("failed:"));
  return { status: dryRun ? "dry_run" : failed ? "partial" : "ok", log };
}

export async function runPlaybook(
  playbookId: string,
  orgId: string,
  requestId: string,
  dryRun: boolean,
  executors: { brief: () => Promise<string>; notify: (message: string) => Promise<string>; export: () => Promise<string> },
): Promise<{ status: string; log: Array<{ step: PlaybookStep; result: string }> }> {
  const pb = await db.workflowPlaybook.findFirst({ where: { id: playbookId, orgId } });
  if (!pb) return { status: "not_found", log: [] };
  if (!pb.enabled && !dryRun) return { status: "disabled", log: [] };
  const parsed = validatePlaybookSteps(pb.steps);
  if (!parsed.ok) return { status: "invalid", log: [] };
  const out = await executePlaybookSteps(parsed.steps, dryRun, executors);
  await db.workflowRun.create({ data: { playbookId, status: out.status, log: out.log as unknown as object } });
  return out;
}

export function learnedThresholdOverrides(prevGroups: SummaryGroupLite[]): Record<string, number> {
  return computeLearnedThresholds(prevGroups);
}

export function fatigueGuard<T extends { lane: string }>(anomalies: T[]): { anomalies: T[]; digestNote: string | null } {
  return capAnomalies(anomalies);
}
