export const RULE_FIELDS = ["driver", "origin", "destination", "broker", "truck", "loadKey", "lane", "date", "revenue", "miles"] as const;
export const RULE_COST_KINDS = ["detention", "fee", "fuel"] as const;

export interface RuleInput {
  costKind: string;
  matchField: string;
  matchValue: string;
  toLoad: string | null;
  reason: string;
}

export function validateRuleInput(body: {
  costKind?: unknown;
  matchField?: unknown;
  matchValue?: unknown;
  toLoad?: unknown;
  reason?: unknown;
}): { ok: true; value: RuleInput } | { ok: false; error: string } {
  if (typeof body.costKind !== "string" || !(RULE_COST_KINDS as readonly string[]).includes(body.costKind)) {
    return { ok: false, error: `costKind must be one of ${RULE_COST_KINDS.join(", ")}` };
  }
  if (typeof body.matchField !== "string" || !(RULE_FIELDS as readonly string[]).includes(body.matchField)) {
    return { ok: false, error: `matchField must be one of ${RULE_FIELDS.join(", ")}` };
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
