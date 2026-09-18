import { validateRuleInput as coreValidate } from "@/lib/core/rules/validate";

export const RULE_FIELDS = ["driver", "origin", "destination", "broker", "truck", "loadKey", "lane", "date", "revenue", "miles"] as const;
export const RULE_COST_KINDS = ["detention", "fee", "fuel"] as const;

export function validateRuleInput(body: {
  costKind?: unknown;
  matchField?: unknown;
  matchValue?: unknown;
  toLoad?: unknown;
  reason?: unknown;
}) {
  return coreValidate(body, { fields: RULE_FIELDS, costKinds: RULE_COST_KINDS });
}
