import { db } from "@/lib/core/db";
import { weekBounds } from "@/lib/core/dates";
import { evaluateAlerts, runPlaybook, type GroupLite } from "@/lib/core/workflow";

const DAYS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function fieldMatch(field: string, value: number, min: number, max: number): boolean {
  const parts = field.split(",");
  for (const part of parts) {
    const p = part.trim();
    if (p === "*") return true;
    if (p.startsWith("*/")) {
      const step = Number(p.slice(2));
      if (Number.isInteger(step) && step > 0 && value % step === 0) return true;
      continue;
    }
    if (p.includes("-")) {
      const [a, b] = p.split("-").map(Number);
      if (Number.isInteger(a) && Number.isInteger(b) && value >= a && value <= b) return true;
      continue;
    }
    const upper = DAYS[p.toUpperCase()];
    if (upper !== undefined && value === upper) return true;
    const n = Number(p);
    if (Number.isInteger(n) && value === n) return true;
  }
  void min;
  void max;
  return false;
}

// Minimal 5-field cron matcher (minute hour dom month dow). Supports *,
// numbers, lists, ranges, steps, and MON-SUN day names. All comparisons use
// the scheduler tick's clock (UTC).
export function cronMatch(schedule: string, at: Date): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string];
  return (
    fieldMatch(minute, at.getUTCMinutes(), 0, 59) &&
    fieldMatch(hour, at.getUTCHours(), 0, 23) &&
    fieldMatch(dom, at.getUTCDate(), 1, 31) &&
    fieldMatch(month, at.getUTCMonth() + 1, 1, 12) &&
    fieldMatch(dow, at.getUTCDay(), 0, 6)
  );
}

export interface PlaybookExecutorsFor {
  (orgId: string, playbookId: string): Promise<{
    brief: () => Promise<string>;
    notify: (message: string) => Promise<string>;
    export: () => Promise<string>;
  } | null>;
}

// Wiring registry: core code registers the pack-backed executors at process
// startup (scripts/worker.ts), so lib/core stays pack-free while the
// scheduler runs real executors.
export interface SchedulerWiring {
  playbookExecutors: PlaybookExecutorsFor;
  groups: GroupsFor;
}

let wiring: SchedulerWiring | null = null;

export function registerSchedulerWiring(w: SchedulerWiring): void {
  wiring = w;
}

export async function runScheduledTick(
  now: Date,
  windowMinutes = 15,
  weekStartsOn = 1
): Promise<{ playbooks: Array<{ playbookId: string; orgId: string; status: string }>; alerts: Array<{ orgId: string; pack: string; fired: number }> }> {
  if (!wiring) return { playbooks: [], alerts: [] };
  const playbooks = await runDuePlaybooks(now, windowMinutes, wiring.playbookExecutors);
  const alerts = await runDueAlerts(now, weekStartsOn, wiring.groups);
  return { playbooks, alerts };
}

// Runs enabled playbooks whose cron schedule fires within the window and
// which have not already run inside the window. Playbooks without a schedule
// never auto-run.
export async function runDuePlaybooks(
  now: Date,
  windowMinutes: number,
  executorsFor: PlaybookExecutorsFor
): Promise<Array<{ playbookId: string; orgId: string; status: string }>> {
  const windowStart = new Date(now.getTime() - windowMinutes * 60_000);
  const playbooks = await db.workflowPlaybook.findMany({
    where: { enabled: true, schedule: { not: null } },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const out: Array<{ playbookId: string; orgId: string; status: string }> = [];
  for (const pb of playbooks) {
    if (!pb.schedule) continue;
    if (!cronMatch(pb.schedule, now)) continue;
    const lastRun = pb.runs[0]?.createdAt;
    if (lastRun && lastRun.getTime() >= windowStart.getTime()) continue;
    const executors = await executorsFor(pb.orgId, pb.id).catch(() => null);
    if (!executors) continue;
    const res = await runPlaybook(pb.id, pb.orgId, `scheduler:${now.toISOString()}`, false, executors);
    out.push({ playbookId: pb.id, orgId: pb.orgId, status: res.status });
  }
  return out;
}

const ALERT_QUIET_MS = 20 * 60 * 60 * 1000;

export interface GroupsFor {
  (orgId: string, pack: string): Promise<GroupLite[] | null>;
}

// Evaluates active alert rules per org+pack. A 20-hour quiet window per org is
// enforced using the notification trail so a ticking scheduler never spams.
export async function runDueAlerts(
  now: Date,
  weekStartsOn: number,
  groupsFor: GroupsFor
): Promise<Array<{ orgId: string; pack: string; fired: number }>> {
  const rules = await db.alertRule.findMany({ where: { active: true } });
  const byOrgPack = new Map<string, { orgId: string; pack: string }>();
  for (const r of rules) byOrgPack.set(`${r.orgId}::${r.pack}`, { orgId: r.orgId, pack: r.pack });
  const out: Array<{ orgId: string; pack: string; fired: number }> = [];
  const anchor = now.toISOString().slice(0, 10);
  const { start } = weekBounds(anchor, weekStartsOn);
  void start;
  for (const { orgId, pack } of byOrgPack.values()) {
    const recent = await db.notification.findFirst({
      where: { organizationId: orgId, kind: "alert", createdAt: { gte: new Date(now.getTime() - ALERT_QUIET_MS) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) continue;
    const groups = await groupsFor(orgId, pack).catch(() => null);
    if (!groups) continue;
    const res = await evaluateAlerts(orgId, pack, weekStartsOn, anchor, async () => groups);
    out.push({ orgId, pack, fired: res.fired.length });
  }
  return out;
}
