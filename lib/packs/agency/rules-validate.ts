import { validateRuleInput as coreValidate } from "@/lib/core/rules/validate";

export const AGENCY_RULE_FIELDS = ["client", "project", "round", "person", "date", "hours", "amount", "loadKey"] as const;
export const AGENCY_RULE_COST_KINDS = ["labor", "rush", "asset"] as const;

export function validateAgencyRuleInput(body: {
  costKind?: unknown;
  matchField?: unknown;
  matchValue?: unknown;
  toLoad?: unknown;
  reason?: unknown;
}) {
  return coreValidate(body, { fields: AGENCY_RULE_FIELDS, costKinds: AGENCY_RULE_COST_KINDS });
}
