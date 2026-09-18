import { validateRuleInput } from "@/lib/rules/validate";
import { describe, expect, it } from "vitest";

describe("validateRuleInput (W1)", () => {
  it("accepts a well-formed rule and normalizes EXCLUDE", () => {
    const r = validateRuleInput({ costKind: "detention", matchField: "driver", matchValue: " Deshawn ", toLoad: "EXCLUDE", reason: "x" });
    expect(r).toEqual({ ok: true, value: { costKind: "detention", matchField: "driver", matchValue: "Deshawn", toLoad: null, reason: "x" } });
  });

  it("rejects bad kinds, fields, and blank values", () => {
    expect(validateRuleInput({ costKind: "tolls", matchField: "driver", matchValue: "x" }).ok).toBe(false);
    expect(validateRuleInput({ costKind: "fee", matchField: "shipper", matchValue: "x" }).ok).toBe(false);
    expect(validateRuleInput({ costKind: "fee", matchField: "driver", matchValue: "  " }).ok).toBe(false);
    expect(validateRuleInput({}).ok).toBe(false);
  });
});
