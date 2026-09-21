import { describe, expect, it } from "vitest";
import { coerceValue, validateKindConfig } from "@/lib/core/ontology/kinds";

describe("ontology kinds (ONT-0011-0030)", () => {
  it("coerces strings with length guards", () => {
    expect(coerceValue("string", "hi")).toEqual({ ok: true, value: "hi" });
    expect(coerceValue("string", "hi", { minLength: 5 }).ok).toBe(false);
    expect(coerceValue("string", "toolong", { maxLength: 3 }).ok).toBe(false);
  });
  it("coerces numbers with min/max", () => {
    expect(coerceValue("number", "42")).toEqual({ ok: true, value: 42 });
    expect(coerceValue("number", "abc").ok).toBe(false);
    expect(coerceValue("currency", -5, { min: 0 }).ok).toBe(false);
    expect(coerceValue("integer", 4.5).ok).toBe(false);
    expect(coerceValue("percent", 101).ok).toBe(false);
    expect(coerceValue("percent", 55)).toEqual({ ok: true, value: 55 });
  });
  it("coerces booleans loosely", () => {
    expect(coerceValue("boolean", "true")).toEqual({ ok: true, value: true });
    expect(coerceValue("boolean", "maybe").ok).toBe(false);
  });
  it("coerces dates", () => {
    expect(coerceValue("date", "2026-09-19")).toEqual({ ok: true, value: "2026-09-19" });
    expect(coerceValue("datetime", "nope").ok).toBe(false);
  });
  it("validates enums, emails, urls, phones", () => {
    expect(coerceValue("enum", "a", { options: ["a", "b"] })).toEqual({ ok: true, value: "a" });
    expect(coerceValue("enum", "z", { options: ["a", "b"] }).ok).toBe(false);
    expect(coerceValue("email", "a@b.co").ok).toBe(true);
    expect(coerceValue("email", "nope").ok).toBe(false);
    expect(coerceValue("url", "https://x.co").ok).toBe(true);
    expect(coerceValue("phone", "+1 312 555 0100").ok).toBe(true);
  });
  it("validates geo bounds and multi refs", () => {
    expect(coerceValue("geo", { lat: 41, lng: -87 })).toEqual({ ok: true, value: { lat: 41, lng: -87 } });
    expect(coerceValue("geo", { lat: 999, lng: 0 }).ok).toBe(false);
    expect(coerceValue("multi_reference", ["a", "b"])).toEqual({ ok: true, value: ["a", "b"] });
    expect(coerceValue("multi_reference", ["a", "b"], { maxCount: 1 }).ok).toBe(false);
  });
  it("treats empty as null and computed as read-only", () => {
    expect(coerceValue("string", "")).toEqual({ ok: true, value: null });
    expect(coerceValue("computed", 5).ok).toBe(false);
  });
  it("validates kind configs", () => {
    expect(validateKindConfig("enum", {})).toHaveLength(1);
    expect(validateKindConfig("enum", { options: ["a"] })).toHaveLength(0);
    expect(validateKindConfig("string", { minLength: "x" as unknown as number })).toHaveLength(1);
  });
});
