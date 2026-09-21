import { describe, expect, it } from "vitest";
import { cronMatch } from "@/lib/core/scheduler";

const at = (iso: string) => new Date(iso);

describe("cron matcher (MFG-0401)", () => {
  it("matches a Monday-morning schedule", () => {
    expect(cronMatch("0 7 * * MON", at("2026-09-14T07:00:00Z"))).toBe(true);
    expect(cronMatch("0 7 * * MON", at("2026-09-15T07:00:00Z"))).toBe(false);
    expect(cronMatch("0 7 * * MON", at("2026-09-14T08:00:00Z"))).toBe(false);
  });

  it("handles wildcards, lists, ranges, and steps", () => {
    expect(cronMatch("* * * * *", at("2026-09-14T07:13:00Z"))).toBe(true);
    expect(cronMatch("0 7,16 * * *", at("2026-09-14T16:00:00Z"))).toBe(true);
    expect(cronMatch("0 7,16 * * *", at("2026-09-14T09:00:00Z"))).toBe(false);
    expect(cronMatch("0 7-9 * * *", at("2026-09-14T08:00:00Z"))).toBe(true);
    expect(cronMatch("*/15 * * * *", at("2026-09-14T07:30:00Z"))).toBe(true);
    expect(cronMatch("*/15 * * * *", at("2026-09-14T07:31:00Z"))).toBe(false);
  });

  it("rejects malformed schedules", () => {
    expect(cronMatch("0 7 * *", at("2026-09-14T07:00:00Z"))).toBe(false);
    expect(cronMatch("not a cron", at("2026-09-14T07:00:00Z"))).toBe(false);
  });
});
