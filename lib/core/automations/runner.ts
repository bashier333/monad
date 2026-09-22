import type { AutomationSpec } from "@/lib/core/automations/spec";

// ---------------------------------------------------------------------------
// Automation runner: dispatches effects through injected runners so the
// orchestration is fully testable. Fallback effects run only when a primary
// fails. History is recorded by the caller-provided recordRun (production
// writes EventLog automation.* rows). Guards re-checked here: muted, expired
// or throttled automations never fire, even if the scheduler misfires.
// ---------------------------------------------------------------------------

export interface AutomationRunners {
  runAction: (actionKey: string, args: Record<string, unknown>, objectId?: string) => Promise<{ ok: boolean; error?: string }>;
  runFunction: (key: string, args: Record<string, unknown>) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
  notify: (message: string, href?: string) => Promise<void>;
}

export interface EffectOutcome {
  kind: string;
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface RunRecord {
  automationKey: string;
  trigger: string;
  status: "ok" | "partial" | "failed" | "skipped";
  effects: EffectOutcome[];
  at: string;
}

export async function fireAutomation(
  spec: AutomationSpec,
  ctx: { trigger: string; args?: Record<string, unknown>; nowMs?: number; recentFiredAtMs?: number[] },
  runners: AutomationRunners,
): Promise<RunRecord> {
  const at = new Date(ctx.nowMs ?? Date.now()).toISOString();
  const skip = (reason: string): RunRecord => ({
    automationKey: spec.key,
    trigger: ctx.trigger,
    status: "skipped",
    effects: [{ kind: "guard", ok: false, error: reason }],
    at,
  });
  const nowMs = ctx.nowMs ?? Date.now();
  if (spec.paused) return skip("paused");
  if (spec.mutedUntilMs != null && nowMs < spec.mutedUntilMs) return skip("muted");
  if (spec.expiresAtMs != null && nowMs >= spec.expiresAtMs) return skip("expired");
  if (spec.throttlePerHour != null) {
    const windowStart = nowMs - 3600_000;
    if ((ctx.recentFiredAtMs ?? []).filter((t) => t >= windowStart).length >= spec.throttlePerHour) {
      return skip("throttled");
    }
  }

  const args = ctx.args ?? {};
  const outcomes: EffectOutcome[] = [];
  const primaries = spec.effects.filter((e) => e.kind !== "fallback");
  for (const e of primaries) {
    try {
      if (e.kind === "action" && e.actionKey) {
        const r = await runners.runAction(e.actionKey, args, e.objectId);
        outcomes.push({ kind: `action:${e.actionKey}`, ok: r.ok, error: r.error });
      } else if (e.kind === "function" && e.functionKey) {
        const r = await runners.runFunction(e.functionKey, { ...e.functionArgs, ...args });
        outcomes.push({ kind: `function:${e.functionKey}`, ok: r.ok, value: r.value, error: r.error });
      } else if (e.kind === "notify" && e.message) {
        await runners.notify(e.message, e.href);
        outcomes.push({ kind: "notify", ok: true });
      } else {
        outcomes.push({ kind: e.kind, ok: false, error: "effect missing its target" });
      }
    } catch (err) {
      outcomes.push({ kind: e.kind, ok: false, error: err instanceof Error ? err.message : "effect threw" });
    }
  }

  const failed = outcomes.filter((o) => !o.ok);
  if (failed.length > 0) {
    for (const e of spec.effects.filter((x) => x.kind === "fallback")) {
      try {
        if (e.message) {
          await runners.notify(e.message, e.href);
          outcomes.push({ kind: "fallback:notify", ok: true });
        } else {
          outcomes.push({ kind: "fallback", ok: false, error: "fallback needs a message" });
        }
      } catch (err) {
        outcomes.push({ kind: "fallback", ok: false, error: err instanceof Error ? err.message : "fallback threw" });
      }
    }
  }

  const okCount = outcomes.filter((o) => o.ok).length;
  return {
    automationKey: spec.key,
    trigger: ctx.trigger,
    status: okCount === outcomes.length ? "ok" : okCount > 0 ? "partial" : "failed",
    effects: outcomes,
    at,
  };
}
