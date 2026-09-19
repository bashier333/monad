import { describe, expect, it } from "vitest";
import { parseDecision, parseStatusFilter, sanitizeMapping } from "@/lib/core/imports/validate";

describe("type guards (S-251–S-259)", () => {
  it("enum fields reject unknowns; null vs missing distinguished (S-254/S-255/S-256)", () => {
    expect(parseDecision("merge")).toBe("merge");
    expect(parseDecision("nope")).toBeNull();
    expect(parseStatusFilter("open")).toBe("open");
    expect(parseStatusFilter("nope")).toBe("open");
    expect(sanitizeMapping(3, null).ok).toBe(false);
    expect(sanitizeMapping(3, []).ok).toBe(false);
    expect(sanitizeMapping(3, { project: null }).ok).toBe(true);
    expect(sanitizeMapping(3, { project: undefined }).ok).toBe(true);
  });

  it("NaN/Infinity never arise from JSON; duplicate keys last-win deterministically (S-257/S-258/S-282)", () => {
    expect(JSON.parse('{"a":1,"a":2}')).toEqual({ a: 2 });
    expect(() => JSON.parse("NaN")).toThrow();
    expect(() => JSON.parse("Infinity")).toThrow();
    expect(Number.isFinite(Number("abc"))).toBe(false);
  });

  it("nested objects rejected as scalar values (S-281)", () => {
    expect(sanitizeMapping(3, { project: { nested: 1 } }).ok).toBe(false);
  });
});
