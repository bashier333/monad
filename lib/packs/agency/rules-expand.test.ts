import { describe, expect, it } from "vitest";
import { correctionFromRow, expandRule, type MatchableRecord } from "@/lib/core/corrections/rules";
import { AGENCY_FIELD_KINDS } from "@/lib/packs/agency/rules";
import { buildAgencyAnswer } from "@/lib/packs/agency/service";
import type { AgencyInput } from "@/lib/packs/agency/engine";

const LOADS: MatchableRecord[] = [
  { loadKey: "R1", project: "ACME", client: "Acme", date: "2026-09-07", person: "Al", round: "R1", hours: "10", amount: "" },
  { loadKey: "R2", project: "ACME", client: "Acme", date: "2026-09-08", person: "Bo", round: "R2", hours: "3", amount: "" },
  { loadKey: "R3", project: "BETA", client: "Beta", date: "2026-09-09", person: "Al", round: "R1", hours: "8", amount: "" },
];

describe("agency rule expansion (X6 E-262/E-295)", () => {
  it("matches text fields (client, project, round)", () => {
    const out = expandRule(
      { id: "t", kind: "reattribute", costKind: "labor", matchField: "client", matchValue: "acme", toLoad: null, reason: "t" },
      LOADS,
      AGENCY_FIELD_KINDS,
    );
    expect(out.map((c) => c.fromLoad).sort()).toEqual(["R1", "R2"]);
    const round = expandRule(
      { id: "t", kind: "reattribute", costKind: "labor", matchField: "round", matchValue: "R1", toLoad: null, reason: "t" },
      LOADS,
      AGENCY_FIELD_KINDS,
    );
    expect(round.map((c) => c.fromLoad).sort()).toEqual(["R1", "R3"]);
  });

  it("matches date ops and numeric thresholds", () => {
    const dates = expandRule(
      { id: "t", kind: "reattribute", costKind: "labor", matchField: "date", matchValue: ">=2026-09-08", toLoad: null, reason: "t" },
      LOADS,
      AGENCY_FIELD_KINDS,
    );
    expect(dates.map((c) => c.fromLoad).sort()).toEqual(["R2", "R3"]);
    const hours = expandRule(
      { id: "t", kind: "reattribute", costKind: "labor", matchField: "hours", matchValue: ">5", toLoad: null, reason: "t" },
      LOADS,
      AGENCY_FIELD_KINDS,
    );
    expect(hours.map((c) => c.fromLoad).sort()).toEqual(["R1", "R3"]);
  });
});

describe("agency correction shapes (X6 E-296)", () => {
  it("maps split/exclude/move from rows", () => {
    expect(correctionFromRow({ id: "1", field: "labor", targetKey: "R1", newValue: "EXCLUDE", reason: "dup" })).toMatchObject({
      fromLoad: "R1",
      toLoad: null,
    });
    expect(correctionFromRow({ id: "2", field: "labor", targetKey: "R1", newValue: "R2", reason: "move" }).toLoad).toBe("R2");
  });
});

describe("agency preview math (X6 E-297)", () => {
  it("group deltas sum to total moved; pct warns past 25%", () => {
    const records: AgencyInput[] = LOADS.map((l, i) => ({
      recordKey: l.loadKey,
      date: l.date,
      project: l.project,
      client: l.client,
      person: l.person,
      task: "edit",
      hours: l.hours,
      rate: "100",
      revenue: "",
      runId: "run",
      fileName: "t.csv",
      rowNumber: i + 2,
    }));
    const invoices = [{ project: "ACME", amount: "5000", runId: "run", fileName: "i.csv", rowNumber: 2 }];
    const inputs = { records, assets: [], fees: [], invoices, budgets: [], aliases: new Map<string, string>(), dataAsOf: null };
    const rule = expandRule(
      { id: "p", kind: "reattribute", costKind: "labor", matchField: "client", matchValue: "acme", toLoad: null, reason: "p" },
      LOADS,
      AGENCY_FIELD_KINDS,
    );
    const withRule = buildAgencyAnswer(inputs, rule, "2026-09-07", "2026-09-13");
    const baseline = buildAgencyAnswer(inputs, [], "2026-09-07", "2026-09-13");
    const base = new Map(baseline.projects.map((p) => [p.project, p.margin]));
    const deltas = withRule.projects.map((p) => p.margin - (base.get(p.project) ?? p.margin));
    const totalMoved = Math.round(deltas.reduce((s, d) => s + Math.abs(d), 0) * 100) / 100;
    expect(totalMoved).toBeGreaterThan(0);
    const pct = withRule.totals.cost === 0 ? 0 : Math.round((totalMoved / withRule.totals.cost) * 10000) / 100;
    expect(pct).toBeGreaterThan(25);
  });
});
