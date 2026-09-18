import { detectAnomalies, money, rankGroups, type SummaryGroup } from "@/lib/core/brief/summary";
import { describe, expect, it } from "vitest";

const GROUPS: SummaryGroup[] = [
  { key: "A", margin: -200, marginPct: -20 as number | null, cost: 1200, costByKind: { detention: 150, fuel: 300 } },
  { key: "B", margin: 900, marginPct: 90 as number | null, cost: 100, costByKind: { fuel: 50 } },
];

describe("brief summary primitives (core)", () => {
  it("ranks winners and losers", () => {
    const { winners, losers } = rankGroups(GROUPS);
    expect(losers[0]).toEqual({ key: "A", margin: -200 });
    expect(winners[0]).toEqual({ key: "B", margin: 900 });
  });

  it("detects swings with overrides and suppression", () => {
    const prev = [
      { key: "A", margin: 100, marginPct: 10 as number | null, cost: 900, costByKind: {} },
      { key: "B", margin: 880, marginPct: 88 as number | null, cost: 120, costByKind: {} },
    ];
    const all = detectAnomalies(GROUPS, prev, 6);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ key: "A", swingPts: -30, direction: "down" });
    expect(detectAnomalies(GROUPS, prev, 6, {}, ["A"])).toEqual([]);
    expect(detectAnomalies(GROUPS, prev, 6, { A: 50 })).toEqual([]);
  });

  it("formats money", () => {
    expect(money(12.5)).toBe("$12.50");
  });
});
