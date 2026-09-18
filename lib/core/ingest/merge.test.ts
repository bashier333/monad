import { findConflicts } from "@/lib/core/ingest/merge";
import { describe, expect, it } from "vitest";

describe("findConflicts", () => {
  it("flags fields that differ between overlapping runs", () => {
    const conflicts = findConflicts(
      new Map([["4821", { revenue: "1850.00", broker: "BlueLine" }]]),
      [{ runId: "old", loadKey: "4821", data: { revenue: "1849.00", broker: "BlueLine" } }],
    );
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ loadKey: "4821", field: "revenue", ours: "1850.00", theirs: "1849.00" });
  });

  it("ignores identical values and empty fields", () => {
    const conflicts = findConflicts(
      new Map([["4821", { revenue: "1850.00", broker: "" }]]),
      [{ runId: "old", loadKey: "4821", data: { revenue: "1850.00", broker: "BlueLine" } }],
    );
    expect(conflicts).toEqual([]);
  });

  it("ignores loads with no overlap", () => {
    const conflicts = findConflicts(new Map([["4821", { revenue: "1" }]]), [
      { runId: "old", loadKey: "9999", data: { revenue: "2" } },
    ]);
    expect(conflicts).toEqual([]);
  });
});
