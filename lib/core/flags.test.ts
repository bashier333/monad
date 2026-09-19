import { describe, expect, it } from "vitest";
import { flagEnabled, KNOWN_FLAGS, validateFlags } from "@/lib/core/flags";

describe("feature flags (R-972)", () => {
  it("defaults on, gates per flag", () => {
    expect(flagEnabled({}, "copilot")).toBe(true);
    expect(flagEnabled(null, "copilot")).toBe(true);
    expect(flagEnabled({ featureFlags: ["copilot"] }, "copilot")).toBe(true);
    expect(flagEnabled({ featureFlags: [] }, "copilot")).toBe(false);
    expect(flagEnabled({ featureFlags: "copilot" }, "copilot")).toBe(true);
    expect(KNOWN_FLAGS.length).toBeGreaterThanOrEqual(5);
  });

  it("validates flag names", () => {
    expect(validateFlags(["copilot"])).toEqual({ ok: true, flags: ["copilot"] });
    expect(validateFlags(["pigeon"]).ok).toBe(false);
    expect(validateFlags("copilot").ok).toBe(false);
  });
});
