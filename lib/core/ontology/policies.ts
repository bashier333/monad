export type PolicyEffect = "allow" | "deny";
export type PolicyOp = "eq" | "neq" | "in" | "contains" | "startsWith";

export interface RowPolicy {
  effect: PolicyEffect;
  field: string;
  op: PolicyOp;
  value: unknown;
  priority: number;
}

function getField(data: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((o, part) => {
    if (o && typeof o === "object") return (o as Record<string, unknown>)[part];
    return undefined;
  }, data);
}

function safeEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function policyMatches(policy: RowPolicy, data: Record<string, unknown>): boolean {
  const actual = getField(data, policy.field);
  switch (policy.op) {
    case "eq":
      return safeEqual(actual, policy.value);
    case "neq":
      return !safeEqual(actual, policy.value);
    case "in":
      return Array.isArray(policy.value) && policy.value.some((v) => safeEqual(v, actual));
    case "contains":
      return typeof actual === "string" && typeof policy.value === "string" && actual.includes(policy.value);
    case "startsWith":
      return typeof actual === "string" && typeof policy.value === "string" && actual.startsWith(policy.value);
    default:
      return false;
  }
}

// Combining algebra (Cedar-style, documented, total):
//   1. default-deny — no applicable allow means invisible;
//   2. deny-overrides — any applicable deny beats every allow;
//   3. deterministic order — priority ascending, deny before allow at equal
//      priority, original index as final tie-break (no DB-order leaks).
// A policy whose evaluation throws is SKIPPED and recorded (skip-on-error),
// never treated as a match. Non-matching policies are NotApplicable, which
// is distinct from Deny and observable in the trace.
export type PolicyVerdict = "allow" | "deny" | "not-applicable";

export interface PolicyTraceEntry {
  index: number;
  effect: PolicyEffect;
  field: string;
  op: PolicyOp;
  priority: number;
  verdict: PolicyVerdict | "skipped-error";
}

export interface PolicyDecision {
  allowed: boolean;
  trace: PolicyTraceEntry[];
}

export function decidePolicies(policies: RowPolicy[], data: Record<string, unknown>): PolicyDecision {
  const indexed = policies.map((p, index) => ({ p, index }));
  indexed.sort((a, b) => {
    if (a.p.priority !== b.p.priority) return a.p.priority - b.p.priority;
    if (a.p.effect !== b.p.effect) return a.p.effect === "deny" ? -1 : 1;
    return a.index - b.index;
  });
  // Two passes: record every policy's verdict first, then combine. The trace
  // therefore explains both sides (which allow would have permitted AND
  // which deny overrode it) instead of stopping at the first deny.
  const trace: PolicyTraceEntry[] = [];
  for (const { p, index } of indexed) {
    let matched: boolean;
    try {
      matched = policyMatches(p, data);
    } catch {
      trace.push({ index, effect: p.effect, field: p.field, op: p.op, priority: p.priority, verdict: "skipped-error" });
      continue;
    }
    if (!matched) {
      trace.push({ index, effect: p.effect, field: p.field, op: p.op, priority: p.priority, verdict: "not-applicable" });
      continue;
    }
    trace.push({
      index,
      effect: p.effect,
      field: p.field,
      op: p.op,
      priority: p.priority,
      verdict: p.effect === "deny" ? "deny" : "allow",
    });
  }
  const denied = trace.some((t) => t.verdict === "deny");
  const allowed = !denied && trace.some((t) => t.verdict === "allow");
  return { allowed, trace };
}

export function evaluatePolicies(policies: RowPolicy[], data: Record<string, unknown>): boolean {
  return decidePolicies(policies, data).allowed;
}

// Static analysis: exact duplicates + allows fully shadowed by a deny. A
// deny shadows an allow when they test the same field with equality-style
// ops and every value the allow accepts is also denied at priority <= the
// allow's (so the allow can never decide anything). Returns human-readable
// findings for the ops UI and CI gates — it never changes evaluation.
export function analyzePolicies(policies: RowPolicy[]): string[] {
  const findings: string[] = [];
  const seen = new Map<string, number>();
  policies.forEach((p, i) => {
    const key = `${p.effect}|${p.field}|${p.op}|${safeStringify(p.value)}|${p.priority}`;
    const first = seen.get(key);
    if (first !== undefined) findings.push(`duplicate of policy #${first} at index ${i} (${p.effect} ${p.field} ${p.op})`);
    else seen.set(key, i);
  });
  const allows = policies.map((p, i) => ({ p, i })).filter(({ p }) => p.effect === "allow");
  const denies = policies.map((p, i) => ({ p, i })).filter(({ p }) => p.effect === "deny");
  for (const { p: allow, i } of allows) {
    const shadowed = denies.some(({ p: deny }) => {
      if (deny.priority > allow.priority) return false;
      if (deny.field !== allow.field) return false;
      if (allow.op === "eq" && deny.op === "eq") return safeEqual(deny.value, allow.value);
      if (allow.op === "eq" && deny.op === "in") return Array.isArray(deny.value) && deny.value.some((v) => safeEqual(v, allow.value));
      if (allow.op === "in" && deny.op === "eq") return false;
      if (allow.op === "in" && deny.op === "in")
        return (
          Array.isArray(allow.value) &&
          Array.isArray(deny.value) &&
          allow.value.every((v) => (deny.value as unknown[]).some((d) => safeEqual(d, v)))
        );
      return false;
    });
    if (shadowed) findings.push(`allow at index ${i} (${allow.field} ${allow.op}) is fully shadowed by a deny — it can never permit`);
  }
  return findings;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "undefined";
  } catch {
    return "[unserializable]";
  }
}

export function filterRows<T extends Record<string, unknown>>(policies: RowPolicy[], rows: T[]): T[] {
  if (policies.length === 0) return [];
  return rows.filter((r) => evaluatePolicies(policies, r));
}

const PII_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  /\b\d{3}-\d{2}-\d{4}\b/,
];

export function detectPii(text: string): string[] {
  const hits: string[] = [];
  if (PII_PATTERNS[0]!.test(text)) hits.push("email");
  if (PII_PATTERNS[1]!.test(text)) hits.push("phone");
  if (PII_PATTERNS[2]!.test(text)) hits.push("ssn-like");
  return hits;
}

export function maskPii(text: string): string {
  return text
    .replace(PII_PATTERNS[0]!, "[email]")
    .replace(PII_PATTERNS[1]!, "[phone]")
    .replace(PII_PATTERNS[2]!, "[id]");
}
