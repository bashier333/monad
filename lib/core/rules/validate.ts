export interface RuleInput {
  costKind: string;
  matchField: string;
  matchValue: string;
  toLoad: string | null;
  reason: string;
}

export function validateRuleInput(
  body: {
    costKind?: unknown;
    matchField?: unknown;
    matchValue?: unknown;
    toLoad?: unknown;
    reason?: unknown;
  },
  allowed: { fields: readonly string[]; costKinds: readonly string[] },
): { ok: true; value: RuleInput } | { ok: false; error: string } {
  if (typeof body.costKind !== "string" || !allowed.costKinds.includes(body.costKind)) {
    return { ok: false, error: `costKind must be one of ${allowed.costKinds.join(", ")}` };
  }
  if (typeof body.matchField !== "string" || !allowed.fields.includes(body.matchField)) {
    return { ok: false, error: `matchField must be one of ${allowed.fields.join(", ")}` };
  }
  if (typeof body.matchValue !== "string" || body.matchValue.trim() === "") {
    return { ok: false, error: "matchValue is required" };
  }
  const rawTo = typeof body.toLoad === "string" ? body.toLoad.trim() : "";
  return {
    ok: true,
    value: {
      costKind: body.costKind,
      matchField: body.matchField,
      matchValue: body.matchValue.trim(),
      toLoad: rawTo === "" || rawTo === "EXCLUDE" ? null : rawTo,
      reason: typeof body.reason === "string" ? body.reason.slice(0, 5000) : "",
    },
  };
}
