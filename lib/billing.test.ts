import { FREE_LIMITS, historyAllowed, READ_ONLY_AFTER_DAYS, toSubState } from "@/lib/billing";
import { describe, expect, it } from "vitest";

function sub(tier: string, status: string, daysAgo = 0) {
  return { tier, status, statusChangedAt: new Date(Date.now() - daysAgo * 86_400_000) };
}

describe("billing rules", () => {
  it("paid tiers are never read-only", () => {
    expect(toSubState(sub("team", "past_due", 99)).readOnly).toBe(false);
    expect(toSubState(sub("scale", "active")).tier).toBe("scale");
  });

  it("locks free orgs 21 days after payment failure — never deletes data", () => {
    expect(toSubState(sub("free", "past_due", READ_ONLY_AFTER_DAYS - 1)).readOnly).toBe(false);
    expect(toSubState(sub("free", "past_due", READ_ONLY_AFTER_DAYS)).readOnly).toBe(true);
    expect(toSubState(sub("free", "active")).readOnly).toBe(false);
  });

  it("limits free history to 90 days", () => {
    const free = toSubState(sub("free", "active"));
    const now = new Date("2026-09-18T00:00:00Z");
    expect(historyAllowed(free, "2026-09-01", now)).toBe(true);
    expect(historyAllowed(free, "2026-05-01", now)).toBe(false);
    expect(historyAllowed(toSubState(sub("team", "active")), "2020-01-01", now)).toBe(true);
  });

  it("pins the free limits", () => {
    expect(FREE_LIMITS).toMatchObject({ uploadsPerMonth: 10, historyDays: 90 });
  });
});
