import type { AutomationSpec } from "@/lib/core/automations/spec";
import { validateAutomationSpec } from "@/lib/core/automations/spec";

// ---------------------------------------------------------------------------
// Automation templates + marketplace envelope (H tail). Templates are pure
// spec builders validated through the same gate as hand-written automations.
// The marketplace envelope ports automations across orgs byte-identically.
// ---------------------------------------------------------------------------

export function weeklyReportSpec(day: "MON" | "TUE" | "WED" | "THU" | "FRI" = "MON"): AutomationSpec {
  const spec = {
    key: "weekly_report",
    name: "Weekly report",
    trigger: { kind: "schedule", cron: `0 7 * * ${day}` },
    effects: [
      { kind: "function", functionKey: "brief_build" },
      { kind: "notify", message: "Weekly brief is ready", href: "/briefs" },
      { kind: "fallback", message: "Weekly brief automation needs attention" },
    ],
    maxRetries: 3,
    backoff: "exponential",
    paused: false,
    dependsOn: [],
    enabled: true,
  } as const;
  const parsed = validateAutomationSpec(spec);
  if (!parsed.ok) throw new Error(`weekly report template invalid: ${JSON.stringify(parsed.problems)}`);
  return parsed.value;
}

export function scenarioAutomationSpec(
  branchName: string,
  functionKey: string,
): AutomationSpec {
  const key = `scenario_${branchName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const spec = {
    key,
    name: `Scenario watch: ${branchName}`,
    trigger: { kind: "manual" },
    effects: [
      { kind: "function", functionKey },
      { kind: "notify", message: `Scenario ${branchName} evaluated` },
    ],
    maxRetries: 1,
    backoff: "constant",
    paused: false,
    dependsOn: [],
    enabled: true,
  } as const;
  const parsed = validateAutomationSpec(spec);
  if (!parsed.ok) throw new Error(`scenario template invalid: ${JSON.stringify(parsed.problems)}`);
  return parsed.value;
}

export interface AutomationEnvelope {
  format: "monad-automation/1";
  exportedAt: string;
  automation: AutomationSpec;
}

export function exportAutomation(spec: AutomationSpec): AutomationEnvelope {
  return {
    format: "monad-automation/1",
    exportedAt: new Date().toISOString(),
    automation: JSON.parse(JSON.stringify(spec)) as AutomationSpec,
  };
}

export function importAutomationEnvelope(input: unknown):
  | { ok: true; value: AutomationSpec }
  | { ok: false; error: string } {
  const env = input as Partial<AutomationEnvelope> | null;
  if (!env || env.format !== "monad-automation/1" || !env.automation) {
    return { ok: false, error: "not a monad-automation/1 envelope" };
  }
  const parsed = validateAutomationSpec(env.automation);
  if (!parsed.ok) {
    return { ok: false, error: parsed.problems.map((p) => `${p.field}: ${p.message}`).join("; ") };
  }
  return { ok: true, value: parsed.value };
}
