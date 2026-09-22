import { cronMatch } from "@/lib/core/scheduler";
import { matchConditionRow, orderAutomations, type AutomationSpec } from "@/lib/core/automations/spec";
import { fireAutomation, type AutomationRunners, type RunRecord } from "@/lib/core/automations/runner";

// ---------------------------------------------------------------------------
// Automation tick: evaluates due triggers and fires through the runner.
// Everything external is injected (specs, rows, runners, history, clock),
// so the whole tick is deterministic under test. Production wiring lives in
// scripts/automation-wiring.ts to keep lib/core pack-free.
// ---------------------------------------------------------------------------

export interface TickDeps {
  listSpecs: () => Promise<AutomationSpec[]>;
  getRows: (spec: AutomationSpec) => Promise<Array<Record<string, unknown>>>;
  recentFiredAtMs: (specKey: string) => Promise<number[]>;
  runners: AutomationRunners;
  recordRun: (record: RunRecord) => Promise<void>;
}

export async function runAutomationTick(
  now: Date,
  deps: TickDeps,
): Promise<RunRecord[]> {
  const specs = orderAutomations(await deps.listSpecs());
  const out: RunRecord[] = [];
  for (const spec of specs) {
    if (!spec.enabled) continue;
    const trigger = spec.trigger;
    if (trigger.kind === "manual") continue;
    if (trigger.kind === "schedule" && !cronMatch(trigger.cron, now)) continue;
    let args: Record<string, unknown> = {};
    if (trigger.kind === "condition") {
      const rows = await deps.getRows(spec);
      const matched = rows.filter((r) =>
        matchConditionRow(r, { field: trigger.field, op: trigger.op, value: trigger.value }),
      );
      if (matched.length === 0) continue;
      args = { matchedCount: matched.length, matched: matched.slice(0, 50) };
    }
    const recent = await deps.recentFiredAtMs(spec.key);
    const record = await fireAutomation(
      spec,
      { trigger: trigger.kind, args, nowMs: now.getTime(), recentFiredAtMs: recent },
      deps.runners,
    );
    out.push(record);
    await deps.recordRun(record);
  }
  return out;
}
