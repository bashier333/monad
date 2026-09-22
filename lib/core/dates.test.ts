import { describe, expect, it } from "vitest";
import { toISODate, weekBounds } from "@/lib/core/dates";

describe("toISODate", () => {
  it("normalizes parseable dates, nulls the rest", () => {
    expect(toISODate("2026-09-21")).toBe("2026-09-21");
    expect(toISODate("not a date")).toBeNull();
    expect(toISODate("")).toBeNull();
  });
});

describe("weekBounds", () => {
  it("honors Monday and Sunday starts across month edges", () => {
    expect(weekBounds("2026-09-23", 1)).toEqual({ start: "2026-09-21", end: "2026-09-27" });
    expect(weekBounds("2026-09-23", 0)).toEqual({ start: "2026-09-20", end: "2026-09-26" });
    expect(weekBounds("2026-03-01", 1)).toEqual({ start: "2026-02-23", end: "2026-03-01" });
  });
});
