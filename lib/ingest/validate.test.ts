import type { CanonicalField } from "@/lib/ingest/columns";
import { validateRow } from "@/lib/ingest/validate";
import { describe, expect, it } from "vitest";

function rec(partial: Partial<Record<CanonicalField, string>>): Record<CanonicalField, string> {
  return {
    loadId: "",
    date: "",
    origin: "",
    destination: "",
    driver: "",
    truck: "",
    revenue: "",
    miles: "",
    broker: "",
    detention: "",
    gallons: "",
    amount: "",
    station: "",
    fee: "",
    paidDate: "",
    ...partial,
  };
}

const TMS = { required: ["loadId", "date", "revenue"] as CanonicalField[], checkDuplicatesOn: "loadId" as const };

describe("validateRow", () => {
  it("accepts a clean row", () => {
    const issues = validateRow(
      rec({ loadId: "4821", date: "2026-09-07", revenue: "1850.00", miles: "242" }),
      new Set(),
      TMS,
    );
    expect(issues).toEqual([]);
  });

  it("flags missing required fields", () => {
    const issues = validateRow(rec({ loadId: "4823", date: "2026-09-09" }), new Set(), TMS);
    expect(issues.map((i) => i.code)).toContain("REQUIRED");
  });

  it("flags unparseable dates", () => {
    const issues = validateRow(
      rec({ loadId: "4824", date: "13/40/2026", revenue: "900" }),
      new Set(),
      TMS,
    );
    expect(issues.map((i) => i.code)).toContain("INVALID_DATE");
  });

  it("flags negative miles", () => {
    const issues = validateRow(
      rec({ loadId: "4825", date: "2026-09-10", revenue: "640", miles: "-12" }),
      new Set(),
      TMS,
    );
    expect(issues.map((i) => i.code)).toContain("NEGATIVE_VALUE");
  });

  it("flags duplicate load keys within a file", () => {
    const seen = new Set(["4821"]);
    const issues = validateRow(
      rec({ loadId: "4821", date: "2026-09-07", revenue: "1850" }),
      seen,
      TMS,
    );
    expect(issues.map((i) => i.code)).toContain("DUPLICATE_KEY");
  });
});
