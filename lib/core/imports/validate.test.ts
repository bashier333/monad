import { parseDecision, parseStatusFilter, sanitizeMapping } from "@/lib/core/imports/validate";
import { describe, expect, it } from "vitest";

describe("import input validation (W1)", () => {
  it("parses decisions, rejecting unknowns", () => {
    expect(parseDecision("merge")).toBe("merge");
    expect(parseDecision("replace")).toBe("replace");
    expect(parseDecision("skip")).toBe("skip");
    expect(parseDecision("delete")).toBeNull();
    expect(parseDecision(null)).toBeNull();
    expect(parseDecision(42)).toBeNull();
  });

  it("sanitizes mappings, rejecting out-of-range indexes", () => {
    expect(sanitizeMapping(10, { loadId: 0, revenue: 6 })).toEqual({ ok: true, mapping: { loadId: 0, revenue: 6 } });
    expect(sanitizeMapping(10, { loadId: 10 }).ok).toBe(false);
    expect(sanitizeMapping(10, { loadId: -1 }).ok).toBe(false);
    expect(sanitizeMapping(10, { loadId: 1.5 }).ok).toBe(false);
    expect(sanitizeMapping(10, { loadId: null })).toEqual({ ok: true, mapping: {} });
    expect(sanitizeMapping(10, [1, 2]).ok).toBe(false);
    expect(sanitizeMapping(10, "x").ok).toBe(false);
  });

  it("falls back to open for unknown status filters", () => {
    expect(parseStatusFilter("applied")).toBe("applied");
    expect(parseStatusFilter("bogus")).toBe("open");
    expect(parseStatusFilter(null)).toBe("open");
  });
});
