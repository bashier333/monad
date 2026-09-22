import { z } from "zod";

export const EFFECT_KINDS = ["set", "link", "unlink", "create"] as const;

const effectSchema = z.object({
  kind: z.enum(EFFECT_KINDS),
  property: z.string().max(64).optional(),
  value: z.unknown().optional(),
  linkKey: z.string().max(64).optional(),
  targetId: z.string().max(64).optional(),
  typeKey: z.string().max(64).optional(),
  data: z.record(z.unknown()).optional(),
});

export const actionDefSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  label: z.string().min(1).max(120),
  targetTypeKey: z.string().min(1).max(64),
  inputs: z.record(z.unknown()).default({}),
  effects: z.array(effectSchema).min(1).max(20),
  approvalPolicy: z.enum(["none", "single", "quorum"]).default("none"),
  requiredCount: z.number().int().min(1).max(10).default(1),
});

export type ActionEffect = z.infer<typeof effectSchema>;
export type ActionDef = z.infer<typeof actionDefSchema>;

export function validateActionDef(input: unknown):
  | { ok: true; value: ActionDef }
  | { ok: false; problems: Array<{ field: string; message: string }> } {
  const parsed = actionDefSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    };
  }
  const problems: Array<{ field: string; message: string }> = [];
  parsed.data.effects.forEach((e, i) => {
    if (e.kind === "set" && !e.property) problems.push({ field: `effects.${i}`, message: "set needs property" });
    if ((e.kind === "link" || e.kind === "unlink") && (!e.linkKey || !e.targetId)) {
      problems.push({ field: `effects.${i}`, message: "link/unlink need linkKey and targetId" });
    }
    if (e.kind === "create" && (!e.typeKey || !e.data)) {
      problems.push({ field: `effects.${i}`, message: "create needs typeKey and data" });
    }
  });
  if (parsed.data.approvalPolicy === "none" && parsed.data.requiredCount !== 1) {
    problems.push({ field: "requiredCount", message: "must be 1 when policy is none" });
  }
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, value: parsed.data };
}

export interface DryRunChange {
  effect: string;
  before: unknown;
  after: unknown;
}

export function dryRunSet(
  current: Record<string, unknown>,
  effects: ActionEffect[]
): DryRunChange[] {
  const changes: DryRunChange[] = [];
  for (const e of effects) {
    if (e.kind === "set" && e.property) {
      changes.push({ effect: `set ${e.property}`, before: current[e.property] ?? null, after: e.value ?? null });
    } else if (e.kind === "link") {
      changes.push({ effect: `link ${e.linkKey} -> ${e.targetId}`, before: "absent", after: "present" });
    } else if (e.kind === "unlink") {
      changes.push({ effect: `unlink ${e.linkKey} -> ${e.targetId}`, before: "present", after: "absent" });
    } else if (e.kind === "create") {
      changes.push({ effect: `create ${e.typeKey}`, before: null, after: e.data ?? null });
    }
  }
  return changes;
}

export function applySetEffects(
  current: Record<string, unknown>,
  effects: ActionEffect[]
): Record<string, unknown> {
  const out = { ...current };
  for (const e of effects) {
    if (e.kind === "set" && e.property) out[e.property] = e.value ?? null;
  }
  return out;
}

export function quorumReached(approvals: string[], requiredCount: number): boolean {
  return new Set(approvals).size >= requiredCount;
}

// Auto-execution gate: the single choke point any future auto-runner must
// call. Only approval-free, enabled actions are eligible — quorum/single
// actions always wait for a human. Surfaced live on every preview response.
export function canAutoExecute(approvalPolicy: string, enabled: boolean): boolean {
  return enabled && approvalPolicy === "none";
}

export function isExpired(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}
