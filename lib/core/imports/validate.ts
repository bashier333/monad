export type Decision = "merge" | "replace" | "skip";

export function parseDecision(input: unknown): Decision | null {
  return input === "merge" || input === "replace" || input === "skip" ? input : null;
}

export function sanitizeMapping(
  headersLength: number,
  input: unknown,
): { ok: true; mapping: Record<string, number> } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "mapping must be an object" };
  }
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > 200) {
    return { ok: false, error: "mapping has too many keys (max 200)" };
  }
  const mapping: Record<string, number> = {};
  for (const [field, idx] of entries) {
    if (field === "__proto__" || field === "constructor" || field === "prototype") {
      return { ok: false, error: `invalid field name: ${field}` };
    }
    if (idx === null || idx === undefined) continue;
    if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) >= headersLength) {
      return { ok: false, error: `column index out of range for field ${field}` };
    }
    mapping[field] = idx as number;
  }
  return { ok: true, mapping };
}

const KNOWN_STATUSES = new Set(["open", "applied", "rejected", "reverted", "all"]);

export function parseStatusFilter(input: unknown): string {
  return typeof input === "string" && KNOWN_STATUSES.has(input) ? input : "open";
}
