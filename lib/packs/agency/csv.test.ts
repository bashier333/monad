import { describe, expect, it } from "vitest";
import { buildAgencyExportCSV } from "@/lib/packs/agency/csv";
import type { AgencyLoadMargin, ProjectMargin } from "@/lib/packs/agency/engine";

const projects: ProjectMargin[] = [
  {
    project: "ACME",
    client: "Acme",
    revisions: 2,
    revenue: 2500,
    cost: 1600,
    margin: 900,
    marginPct: 36,
    budget: 2000,
    budgetVsActual: -400,
    costByKind: { labor: 1600 },
    recordKeys: ["R1"],
    appliedRules: [],
    loads: [],
  },
];

const loads: AgencyLoadMargin[] = [
  {
    loadKey: "R1",
    date: "2026-09-07",
    project: "ACME",
    client: "Acme",
    person: "Al",
    task: "=cmd|evil",
    hours: 10,
    revenue: 0,
    costs: [
      {
        kind: "labor",
        label: "Labor (Al)",
        amount: 1000,
        ruleId: "R-ag-1",
        source: { runId: "r", fileName: "t.csv", rowNumbers: [2] },
      },
    ],
    totalCost: 1000,
    margin: -1000,
    marginPct: null,
  },
];

describe("agency export CSV (X5 E-231/E-232)", () => {
  it("emits project + revision lines with source pins", () => {
    const csv = buildAgencyExportCSV(projects, loads, null);
    expect(csv).toContain("project,client,revisions,revenue,cost,margin,margin_pct");
    expect(csv).toContain("ACME,Acme,2,2500,1600,900,36");
    expect(csv).toContain("R-ag-1");
    expect(csv).toContain("t.csv");
  });

  it("guards formula injection on agency text fields", () => {
    const csv = buildAgencyExportCSV(projects, loads, null);
    expect(csv).toContain("'=cmd|evil");
  });

  it("project filter narrows both sections", () => {
    const csv = buildAgencyExportCSV(projects, loads, "OTHER");
    expect(csv).not.toContain("ACME");
  });

  it("formula cells stay quoted through export (S-213/S-214)", () => {
    const csv = buildAgencyExportCSV(projects, loads, null);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("project,client,revisions,revenue,cost,margin,margin_pct");
  });
});
