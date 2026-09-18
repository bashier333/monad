import { buildBrief } from "@/lib/brief/build";
import type { WeeklyAnswer } from "@/lib/answers/service";
import { describe, expect, it } from "vitest";

function fakeAnswer(
  weekStart: string,
  lanes: Array<{ lane: string; margin: number; marginPct: number | null; costByKind?: Record<string, number> }>,
): WeeklyAnswer {
  const mapped = lanes.map((l, i) => ({
    lane: l.lane,
    origin: l.lane,
    destination: "",
    loads: 1,
    revenue: 1000,
    cost: 1000 - l.margin,
    margin: l.margin,
    marginPct: l.marginPct,
    costByKind: l.costByKind ?? {},
    loadKeys: [`L${i}`],
    appliedRules: [],
  }));
  const totals = {
    revenue: mapped.reduce((s, l) => s + l.revenue, 0),
    cost: mapped.reduce((s, l) => s + l.cost, 0),
    margin: mapped.reduce((s, l) => s + l.margin, 0),
    marginPct: 50,
    loads: mapped.length,
  };
  return {
    lanes: mapped,
    loads: [],
    totals,
    appliedRules: [],
    adjustments: [],
    meta: { weekStart, weekEnd: weekStart, currency: "USD", distanceUnit: "miles", engineVersion: "m1", dataAsOf: null },
  };
}

describe("buildBrief", () => {
  it("picks winners, losers, and flags a >6pt swing with causes", () => {
    const cur = fakeAnswer("2026-09-14", [
      { lane: "A", margin: -200, marginPct: -20, costByKind: { detention: 150, fuel: 300 } },
      { lane: "B", margin: 900, marginPct: 90, costByKind: { fuel: 50 } },
    ]);
    const prev = fakeAnswer("2026-09-07", [
      { lane: "A", margin: 100, marginPct: 10, costByKind: {} },
      { lane: "B", margin: 880, marginPct: 88, costByKind: {} },
    ]);
    const b = buildBrief(cur, prev, 2);
    expect(b.losers[0]).toMatchObject({ lane: "A" });
    expect(b.winners[0]).toMatchObject({ lane: "B" });
    expect(b.anomalies).toHaveLength(1);
    expect(b.anomalies[0]).toMatchObject({ lane: "A", swingPts: -30, direction: "down" });
    expect(b.anomalies[0].causes.join(" ")).toContain("fuel");
    expect(b.paragraph).toContain("Week of 2026-09-14");
    expect(b.paragraph).toContain("2 corrections still open");
  });

  it("handles a first week with no previous brief", () => {
    const b = buildBrief(fakeAnswer("2026-09-07", [{ lane: "A", margin: 100, marginPct: 10 }]), null, 0);
    expect(b.prevTotals).toBeNull();
    expect(b.anomalies).toEqual([]);
    expect(b.paragraph).not.toContain("corrections");
  });

  it("calls out new lanes, trucks, and brokers since last week", () => {
    const b = buildBrief(
      fakeAnswer("2026-09-14", [{ lane: "A", margin: 100, marginPct: 10 }]),
      fakeAnswer("2026-09-07", [{ lane: "A", margin: 100, marginPct: 10 }]),
      0,
      6,
      { lanes: ["C → D"], trucks: ["Unit 9"], brokers: ["NewBroker"] },
    );
    expect(b.newSince).toMatchObject({ lanes: ["C → D"], trucks: ["Unit 9"], brokers: ["NewBroker"] });
    expect(b.paragraph).toContain("New since last week");
    expect(b.paragraph).toContain("1 new lane");
  });
});
