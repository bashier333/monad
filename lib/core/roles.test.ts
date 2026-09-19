import { describe, expect, it } from "vitest";
import { can, requireCan, type Action } from "@/lib/core/roles";

const ACTIONS: Action[] = [
  "answer:view",
  "upload:import",
  "correction:propose",
  "correction:approve",
  "rule:manage",
  "org:invite",
  "billing:manage",
];

describe("RBAC matrix (R-619)", () => {
  it("owners can do everything, viewers only view", () => {
    for (const a of ACTIONS) expect(can("OWNER", a)).toBe(true);
    for (const a of ACTIONS) {
      if (a === "answer:view") expect(can("VIEWER", a)).toBe(true);
      else expect(can("VIEWER", a)).toBe(false);
    }
  });

  it("dispatchers upload/propose but never approve/manage/bill", () => {
    expect(can("DISPATCHER", "upload:import")).toBe(true);
    expect(can("DISPATCHER", "correction:propose")).toBe(true);
    expect(can("DISPATCHER", "correction:approve")).toBe(false);
    expect(can("DISPATCHER", "rule:manage")).toBe(false);
    expect(can("DISPATCHER", "billing:manage")).toBe(false);
  });

  it("requireCan throws 403 with role + action", () => {
    try {
      requireCan("VIEWER", "rule:manage");
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toMatch(/VIEWER.*rule:manage/);
      expect((e as Error & { status?: number }).status).toBe(403);
    }
  });
});
