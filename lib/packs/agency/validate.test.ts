import { validateAgencyRow } from "@/lib/packs/agency/validate";
import { AGENCY_FIELDS, type AgencyField } from "@/lib/packs/agency/fields";
import { describe, expect, it } from "vitest";

function rec(partial: Partial<Record<AgencyField, string>>): Record<AgencyField, string> {
  const base = {} as Record<AgencyField, string>;
  for (const f of AGENCY_FIELDS) base[f] = "";
  return { ...base, ...partial };
}

describe("validateAgencyRow (X4)", () => {
  it("accepts clean time + invoice rows", () => {
    expect(validateAgencyRow(rec({ project: "Acme", date: "2026-09-07", hours: "10" }), new Set(), "time")).toEqual([]);
    expect(validateAgencyRow(rec({ project: "Acme", amount: "500" }), new Set(), "invoice")).toEqual([]);
  });

  it("flags missing project, bad dates, negative hours, dup entries", () => {
    expect(validateAgencyRow(rec({ date: "2026-09-07" }), new Set(), "time").map((i) => i.code)).toContain("REQUIRED");
    expect(validateAgencyRow(rec({ project: "A", date: "never" }), new Set(), "time").map((i) => i.code)).toContain("INVALID_DATE");
    expect(validateAgencyRow(rec({ project: "A", date: "2026-09-07", hours: "-2" }), new Set(), "time").map((i) => i.code)).toContain("NEGATIVE_VALUE");
    const seen = new Set<string>();
    validateAgencyRow(rec({ project: "A", date: "2026-09-07", person: "Al", task: "edit" }), seen, "time");
    expect(validateAgencyRow(rec({ project: "A", date: "2026-09-07", person: "Al", task: "edit" }), seen, "time").map((i) => i.code)).toContain("DUPLICATE_KEY");
  });
});
