import {
  computeProjectMargins,
  weekBounds,
  type AgencyAsset,
  type AgencyFee,
  type AgencyInput,
  type AgencyInvoice,
} from "@/lib/packs/agency/engine";
import { seedAgencyAliases } from "@/lib/packs/agency/places";
import { describe, expect, it } from "vitest";

function rec(o: Partial<AgencyInput> & { recordKey: string }): AgencyInput {
  return {
    date: "2026-09-07",
    project: "Acme Site",
    client: "Acme",
    person: "Alice",
    task: "edit",
    hours: "0",
    rate: "100",
    revenue: "",
    runId: "r1",
    fileName: "time.csv",
    rowNumber: 2,
    ...o,
  };
}

const WEEK = { start: "2026-09-07", end: "2026-09-13" };
const ALIASES = seedAgencyAliases();

const RECORDS: AgencyInput[] = [
  rec({ recordKey: "T1", date: "2026-09-07", project: "Acme Site", hours: "10", rate: "100", person: "Alice" }),
  rec({ recordKey: "T2", date: "2026-09-08", project: "ACME SITE", hours: "5", rate: "80", person: "Bob" }),
  rec({ recordKey: "T3", date: "2026-09-09", project: "Beta Logo", client: "Beta", hours: "4", rate: "100" }),
];
const ASSETS: AgencyAsset[] = [
  { project: "Acme Site", date: "2026-09-08", amount: "300", runId: "a1", fileName: "assets.csv", rowNumber: 2 },
];
const FEES: AgencyFee[] = [
  { project: "Acme Site", fee: "150", runId: "f1", fileName: "fees.csv", rowNumber: 2 },
];
const INVOICES: AgencyInvoice[] = [
  { project: "Acme Site", amount: "2500", runId: "i1", fileName: "inv.csv", rowNumber: 2 },
  { project: "Beta Logo", amount: "1200", runId: "i1", fileName: "inv.csv", rowNumber: 3 },
  { project: "GhostCo", amount: "500", runId: "i1", fileName: "inv.csv", rowNumber: 4 },
];

describe("agency margin engine (hand-computed)", () => {
  it("merges project aliases and computes project margins to the cent", () => {
    const r = computeProjectMargins(RECORDS, ASSETS, FEES, INVOICES, ALIASES, [], WEEK.start, WEEK.end);
    expect(r.projects).toHaveLength(2);
    const acme = r.projects.find((p) => p.project === "ACME SITE");
    const beta = r.projects.find((p) => p.project === "BETA LOGO");
    expect(acme).toMatchObject({ revisions: 2, revenue: 2500, cost: 1850, margin: 650, marginPct: 26 });
    expect(beta).toMatchObject({ revisions: 1, revenue: 1200, cost: 400, margin: 800, marginPct: 66.67 });
    expect(r.totals).toMatchObject({ revenue: 3700, cost: 2250, margin: 1450, marginPct: 39.19, revisions: 3 });
    expect(r.unmatchedRevenue).toEqual([{ project: "GHOSTCO", amount: 500 }]);
  });

  it("excludes out-of-week records", () => {
    const r = computeProjectMargins(
      [...RECORDS, rec({ recordKey: "T9", date: "2026-09-20", hours: "40" })],
      ASSETS, FEES, INVOICES, ALIASES, [], WEEK.start, WEEK.end,
    );
    expect(r.totals.revisions).toBe(3);
  });

  it("applies a correction that excludes a rush fee", () => {
    const r = computeProjectMargins(RECORDS, ASSETS, FEES, INVOICES, ALIASES, [
      { id: "c1", costKind: "rush", fromLoad: "T1", toLoad: null, reason: "client covered" },
    ], WEEK.start, WEEK.end);
    const acme = r.projects.find((p) => p.project === "ACME SITE");
    expect(acme).toMatchObject({ cost: 1700, margin: 800 });
    expect(r.adjustments).toHaveLength(1);
  });

  it("is deterministic: same inputs, byte-identical outputs", () => {
    const a = computeProjectMargins(RECORDS, ASSETS, FEES, INVOICES, ALIASES, [], WEEK.start, WEEK.end);
    const b = computeProjectMargins(RECORDS, ASSETS, FEES, INVOICES, ALIASES, [], WEEK.start, WEEK.end);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("handles empty input without NaN", () => {
    const r = computeProjectMargins([], [], [], [], ALIASES, [], WEEK.start, WEEK.end);
    expect(r.projects).toEqual([]);
    expect(r.totals).toMatchObject({ revenue: 0, cost: 0, margin: 0, marginPct: null, revisions: 0 });
  });

  it("computes week bounds", () => {
    expect(weekBounds("2026-09-09", 1)).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });
});

describe("budget vs actual (R-145)", () => {
  it("attaches budget + variance per project", () => {
    const r = computeProjectMargins(
      [rec({ recordKey: "T1", date: "2026-09-07", project: "Acme Site", hours: "10", rate: "100", person: "Alice" })],
      [],
      [],
      [],
      ALIASES,
      [],
      WEEK.start,
      WEEK.end,
      [{ project: "Acme Site", amount: "800" }],
    );
    expect(r.projects[0].budget).toBe(800);
    expect(r.projects[0].budgetVsActual).toBe(200);
  });

  it("null budget when no project-list row", () => {
    const r = computeProjectMargins(
      [rec({ recordKey: "T1", date: "2026-09-07", project: "Acme Site", hours: "10", rate: "100", person: "Alice" })],
      [],
      [],
      [],
      ALIASES,
      [],
      WEEK.start,
      WEEK.end,
    );
    expect(r.projects[0].budget).toBeNull();
    expect(r.projects[0].budgetVsActual).toBeNull();
  });
});
