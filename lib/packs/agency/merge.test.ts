import { describe, expect, it } from "vitest";
import { joinAgencyByProject, type AgencyJoinRow } from "@/lib/packs/agency/merge";

function row(partial: Partial<AgencyJoinRow>): AgencyJoinRow {
  return {
    sourceType: "time",
    project: "",
    date: "2026-09-07",
    person: "Al",
    task: "edit",
    hours: "5",
    amount: "",
    runId: "run-1",
    rowNumber: 2,
    ...partial,
  };
}

describe("joinAgencyByProject (X4 E-189–191)", () => {
  it("joins time + invoice on project key; unmatched revenue listed", () => {
    const r = joinAgencyByProject(
      [
        row({ project: "Acme" }),
        row({ sourceType: "invoice", project: "Acme", amount: "2500", hours: "" }),
        row({ sourceType: "invoice", project: "Ghost", amount: "900", hours: "" }),
      ],
      new Map(),
    );
    expect(r.projects).toEqual(["ACME"]);
    expect(r.unmatchedRevenue).toEqual([{ project: "GHOST", amount: 900 }]);
    expect(r.hourConflicts).toEqual([]);
  });

  it("conflicting hours from two sources listed, never overwritten", () => {
    const r = joinAgencyByProject(
      [
        row({ project: "Acme", hours: "5", runId: "run-1" }),
        row({ project: "Acme", hours: "8", runId: "run-2" }),
      ],
      new Map(),
    );
    expect(r.hourConflicts).toHaveLength(1);
    expect(r.hourConflicts[0]).toMatchObject({ hoursA: 5, hoursB: 8, runA: "run-1", runB: "run-2" });
  });

  it("identical re-uploads are not conflicts", () => {
    const r = joinAgencyByProject(
      [row({ project: "Acme", hours: "5" }), row({ project: "Acme", hours: "5", runId: "run-2" })],
      new Map(),
    );
    expect(r.hourConflicts).toEqual([]);
    expect(r.projects).toEqual(["ACME"]);
  });
});
