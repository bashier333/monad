import { z } from "zod";

// ---------------------------------------------------------------------------
// Automation spec + pure guards. Definitions persist in OntoAutomation;
// history rides on EventLog (type automation.*). The runner (runner.ts)
// orchestrates; everything decidable without I/O lives here and is tested.
// ---------------------------------------------------------------------------

export const TRIGGER_KINDS = ["schedule", "condition", "manual"] as const;
export const EFFECT_KINDS = ["action", "function", "notify", "fallback"] as const;

const triggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("schedule"), cron: z.string().max(64) }),
  z.object({
    kind: z.literal("condition"),
    field: z.string().min(1).max(64),
    op: z.enum(["eq", "neq", "contains", "gte", "lte"]),
    value: z.unknown(),
  }),
  z.object({ kind: z.literal("manual") }),
]);

const effectSchema = z.object({
  kind: z.enum(EFFECT_KINDS),
  actionKey: z.string().max(80).optional(),
  // Explicit write target: automation actions never pick an arbitrary
  // object. Absent objectId fails the effect closed.
  objectId: z.string().max(64).optional(),
  functionKey: z.string().max(80).optional(),
  functionArgs: z.record(z.unknown()).optional(),
  message: z.string().max(500).optional(),
  href: z.string().max(300).optional(),
});

export const automationSpecSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, "key must be snake_case, 2-64 chars"),
  name: z.string().min(1).max(80),
  trigger: triggerSchema,
  effects: z.array(effectSchema).min(1).max(10),
  maxRetries: z.number().int().min(0).max(10).default(3),
  backoff: z.enum(["constant", "exponential"]).default("exponential"),
  paused: z.boolean().default(false),
  mutedUntilMs: z.number().int().optional(),
  expiresAtMs: z.number().int().optional(),
  throttlePerHour: z.number().int().min(1).max(1000).optional(),
  dependsOn: z.array(z.string().max(80)).max(20).default([]),
  enabled: z.boolean().default(true),
});

export type AutomationSpec = z.infer<typeof automationSpecSchema>;

export function validateAutomationSpec(input: unknown) {
  const parsed = automationSpecSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems: Array<{ field: string; message: string }> = [];
  const hasPrimary = parsed.data.effects.some((e) => e.kind !== "fallback");
  if (!hasPrimary) problems.push({ field: "effects", message: "at least one non-fallback effect is required" });
  for (const [i, e] of parsed.data.effects.entries()) {
    if (e.kind === "action" && !e.actionKey) problems.push({ field: `effects.${i}`, message: "action needs actionKey" });
    if (e.kind === "function" && !e.functionKey) problems.push({ field: `effects.${i}`, message: "function needs functionKey" });
    if (e.kind === "notify" && !e.message) problems.push({ field: `effects.${i}`, message: "notify needs message" });
  }
  if (parsed.data.trigger.kind === "schedule") {
    const fields = parsed.data.trigger.cron.trim().split(/\s+/);
    if (fields.length !== 5) problems.push({ field: "trigger.cron", message: "cron needs 5 fields" });
  }
  if (problems.length > 0) return { ok: false as const, problems };
  return { ok: true as const, value: parsed.data };
}

export function isMuted(spec: AutomationSpec, nowMs: number): boolean {
  if (spec.paused) return true;
  if (spec.mutedUntilMs != null && nowMs < spec.mutedUntilMs) return true;
  return false;
}

export function isExpired(spec: AutomationSpec, nowMs: number): boolean {
  return spec.expiresAtMs != null && nowMs >= spec.expiresAtMs;
}

export function throttleAllows(firedAtMs: number[], nowMs: number, perHour?: number): boolean {
  if (perHour == null) return true;
  const windowStart = nowMs - 3600_000;
  return firedAtMs.filter((t) => t >= windowStart).length < perHour;
}

export function retryDelayMs(attempt: number, backoff: "constant" | "exponential"): number {
  if (backoff === "constant") return 30_000;
  return Math.min(30_000 * 2 ** attempt, 600_000);
}

export function shouldRetry(attempts: number, maxRetries: number): boolean {
  return attempts <= maxRetries;
}

// Dependencies order automations sharing state (e.g. sync before brief).
// Cycles are a hard error — dependency graphs must be DAGs.
export function orderAutomations(specs: AutomationSpec[]): AutomationSpec[] {
  const byKey = new Map(specs.map((s) => [s.key, s]));
  const order: AutomationSpec[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (key: string, stack: string[]): void => {
    const s = state.get(key);
    if (s === "done") return;
    if (s === "visiting") throw new Error(`automation cycle detected: ${[...stack, key].join(" -> ")}`);
    state.set(key, "visiting");
    for (const dep of byKey.get(key)?.dependsOn ?? []) {
      if (byKey.has(dep)) visit(dep, [...stack, key]);
    }
    state.set(key, "done");
    const spec = byKey.get(key);
    if (spec) order.push(spec);
  };
  for (const s of specs) visit(s.key, []);
  return order;
}

export function matchConditionRow(
  row: Record<string, unknown>,
  cond: { field: string; op: string; value: unknown },
): boolean {
  const raw = row[cond.field];
  switch (cond.op) {
    case "eq":
      return JSON.stringify(raw ?? null) === JSON.stringify(cond.value ?? null);
    case "neq":
      return JSON.stringify(raw ?? null) !== JSON.stringify(cond.value ?? null);
    case "contains":
      return String(raw ?? "").toLowerCase().includes(String(cond.value ?? "").toLowerCase());
    case "gte":
      return Number(raw) >= Number(cond.value) && Number.isFinite(Number(raw)) && Number.isFinite(Number(cond.value));
    case "lte":
      return Number(raw) <= Number(cond.value) && Number.isFinite(Number(raw)) && Number.isFinite(Number(cond.value));
    default:
      return false;
  }
}
