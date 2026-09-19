import { describe, expect, it } from "vitest";
import { computeProjectMargins, type AgencyInput } from "@/lib/packs/agency/engine";
import { buildAgencyBrief } from "@/lib/packs/agency/brief/build";
import type { AgencyAnswer } from "@/lib/packs/agency/service";

function answer(projects: Array<{ project: string; client: string; hours: string; rate: string; revenue?: string }>, weekStart: string): AgencyAnswer {
  const records: AgencyInput[] = projects.map((p, i) => ({
    recordKey: `R${i}`,
    date: weekStart,
    project: p.project,
    client: p.client,
    person: "Al",
    task: "edit",
    hours: p.hours,
    rate: p.rate,
    revenue: "",
    runId: "run",
    fileName: "t.csv",
    rowNumber: i + 2,
  }));
  const invoices = projects
    .filter((p) => p.revenue)
    .map((p, i) => ({ project: p.project, amount: p.revenue!, runId: "run", fileName: "i.csv", rowNumber: i + 2 }));
  const r = computeProjectMargins(records, [], [], invoices, new Map(), [], weekStart, weekStart);
  return {
    ...r,
    joinConflicts: [],
    meta: { weekStart, weekEnd: weekStart, currency: "USD", distanceUnit: "hours", engineVersion: "a1", dataAsOf: null },
  };
}

describe("agency brief builder (X6 E-271–275)", () => {
  it("ranks winners/losers and writes agency words", () => {
    const cur = answer(
      [
        { project: "GOOD", client: "A", hours: "2", rate: "100", revenue: "2000" },
        { project: "BAD", client: "B", hours: "20", rate: "100", revenue: "500" },
      ],
      "2026-09-07",
    );
    const b = buildAgencyBrief(cur, null, 0);
    expect(b.schemaVersion).toBe(1);
    expect(b.winners[0].lane).toBe("GOOD");
    expect(b.losers[0].lane).toBe("BAD");
    expect(b.paragraph).toMatch(/rounds on 2 projects/);
    expect(b.paragraph).toMatch(/Rework labor/);
    expect(b.totals.loads).toBe(2);
  });

  it("flags margin swings with causes", () => {
    const prev = answer([{ project: "SWING", client: "A", hours: "2", rate: "100", revenue: "2000" }], "2026-08-31");
    const cur = answer([{ project: "SWING", client: "A", hours: "18", rate: "100", revenue: "2000" }], "2026-09-07");
    const b = buildAgencyBrief(cur, prev, 1);
    expect(b.anomalies).toHaveLength(1);
    expect(b.anomalies[0].lane).toBe("SWING");
    expect(b.anomalies[0].causes.join(" ")).toMatch(/labor/);
    expect(b.paragraph).toMatch(/moved more than/);
    expect(b.paragraph).toMatch(/1 correction still open/);
    expect(b.openCorrections).toBe(1);
  });

  it("reports new projects/clients/team", () => {
    const cur = answer([{ project: "NEW", client: "Fresh", hours: "2", rate: "100", revenue: "1000" }], "2026-09-07");
    const b = buildAgencyBrief(cur, null, 0, 6, { projects: ["NEW"], clients: ["Fresh"], team: ["Zoe"] });
    expect(b.paragraph).toMatch(/New since last week: 1 new project \(NEW\), 1 new client, 1 new team member/);
    expect(b.recentDecisions).toEqual([]);
  });

  it("carries recent decisions through", () => {
    const cur = answer([{ project: "P", client: "A", hours: "1", rate: "100" }], "2026-09-07");
    const b = buildAgencyBrief(cur, null, 0, 6, undefined, {
      recentDecisions: [{ load: "R0", field: "labor", status: "applied", reason: "dup" }],
    });
    expect(b.recentDecisions).toHaveLength(1);
  });

  it("empty week returns an empty brief, not a crash (S-923)", () => {
    const cur = answer([], "2026-09-07");
    const b = buildAgencyBrief(cur, null, 0);
    expect(b.winners).toEqual([]);
    expect(b.losers).toEqual([]);
    expect(b.totals.revenue).toBe(0);
    expect(typeof b.paragraph).toBe("string");
  });
});
