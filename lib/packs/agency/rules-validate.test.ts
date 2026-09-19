import { describe, expect, it } from "vitest";
import { AGENCY_RULE_COST_KINDS, AGENCY_RULE_FIELDS, validateAgencyRuleInput } from "@/lib/packs/agency/rules-validate";

describe("agency rule validation (X6 E-261)", () => {
  it("accepts agency kinds/fields and normalizes EXCLUDE", () => {
    const r = validateAgencyRuleInput({ costKind: "labor", matchField: "client", matchValue: " Acme ", toLoad: "EXCLUDE", reason: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.matchValue).toBe("Acme");
      expect(r.value.toLoad).toBeNull();
    }
    expect(AGENCY_RULE_FIELDS).toContain("round");
    expect(AGENCY_RULE_COST_KINDS).toContain("rush");
  });

  it("rejects freight-only fields", () => {
    const r = validateAgencyRuleInput({ costKind: "detention", matchField: "driver", matchValue: "x", toLoad: null });
    expect(r.ok).toBe(false);
  });

  it("rejects arrays/objects for scalar fields (S-251)", () => {
    expect(validateAgencyRuleInput({ costKind: ["labor"], matchField: "client", matchValue: "x", toLoad: null }).ok).toBe(false);
    expect(validateAgencyRuleInput({ costKind: "labor", matchField: { evil: 1 }, matchValue: "x", toLoad: null }).ok).toBe(false);
    expect(validateAgencyRuleInput({ costKind: "labor", matchField: "nope", matchValue: "x", toLoad: null }).ok).toBe(false);
  });
});
