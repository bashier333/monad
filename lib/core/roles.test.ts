import { can } from "@/lib/core/roles";
import { describe, expect, it } from "vitest";

describe("roles matrix", () => {
  it("lets everyone view answers", () => {
    expect(can("OWNER", "answer:view")).toBe(true);
    expect(can("DISPATCHER", "answer:view")).toBe(true);
    expect(can("VIEWER", "answer:view")).toBe(true);
  });

  it("lets owners and dispatchers propose corrections, owners only approve", () => {
    expect(can("OWNER", "correction:propose")).toBe(true);
    expect(can("DISPATCHER", "correction:propose")).toBe(true);
    expect(can("VIEWER", "correction:propose")).toBe(false);
    expect(can("OWNER", "correction:approve")).toBe(true);
    expect(can("DISPATCHER", "correction:approve")).toBe(false);
    expect(can("VIEWER", "correction:approve")).toBe(false);
  });

  it("reserves rules, invites, and billing for owners", () => {
    for (const action of ["rule:manage", "org:invite", "billing:manage"] as const) {
      expect(can("OWNER", action)).toBe(true);
      expect(can("DISPATCHER", action)).toBe(false);
      expect(can("VIEWER", action)).toBe(false);
    }
  });
});
