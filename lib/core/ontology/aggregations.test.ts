import { describe, expect, it } from "vitest";
import {
  avg,
  distinctCount,
  groupBy,
  median,
  sum,
  trailingSum,
  weekOverWeek,
  type DatedRow,
} from "@/lib/core/ontology/aggregations";

// Aggregation proof (F2-02271..F2-02420 topics): every operator executed,
// nulls handled, windows exact.

const ROWS = [
  { lane: "DAL-HOU", revenue: 600, miles: "240" },
  { lane: "DAL-HOU", revenue: 400, miles: 200 },
  { lane: "DAL-ELP", revenue: 1480, miles: 620 },
  { lane: "DAL-ELP", revenue: "bad", miles: 0 },
];

describe("groupBy", () => {
  it("partitions rows by key fn, preserving order", () => {
    const g = groupBy(ROWS, (r) => String(r.lane));
    expect([...g.keys()]).toEqual(["DAL-HOU", "DAL-ELP"]);
    expect(g.get("DAL-HOU")).toHaveLength(2);
  });
  it("handles empty input", () => {
    expect(groupBy([], (r) => String(r.lane)).size).toBe(0);
  });
});

describe("sum/avg/median", () => {
  it("sums numerics, skipping non-numeric strings", () => {
    expect(sum(ROWS, "revenue")).toBe(2480);
    expect(sum([], "revenue")).toBe(0);
  });
  it("averages, null on empty", () => {
    expect(avg(ROWS, "revenue")).toBeCloseTo(2480 / 3);
    expect(avg([], "revenue")).toBeNull();
    expect(avg([{ revenue: "bad" }], "revenue")).toBeNull();
  });
  it("medians odd and even sets", () => {
    expect(median([{ v: 3 }, { v: 1 }, { v: 2 }], "v")).toBe(2);
    expect(median([{ v: 4 }, { v: 1 }, { v: 2 }, { v: 3 }], "v")).toBe(2.5);
    expect(median([], "v")).toBeNull();
  });
  it("counts distinct values by normalized shape", () => {
    expect(distinctCount(ROWS, "lane")).toBe(2);
    expect(distinctCount([{ a: 1 }, { a: 1 }, { a: 2 }], "a")).toBe(2);
  });
  it("coerces numeric strings in miles", () => {
    expect(sum(ROWS, "miles")).toBe(1060);
  });
});

const DATED: DatedRow[] = [
  { date: "2026-09-01", revenue: 100 },
  { date: "2026-09-05", revenue: 200 },
  { date: "2026-09-10", revenue: 400 },
  { date: "2026-09-20", revenue: 800 },
];

describe("trailingSum", () => {
  it("sums the (start, end] window exactly", () => {
    expect(trailingSum(DATED, "revenue", "2026-09-10", 9)).toBe(600);
    expect(trailingSum(DATED, "revenue", "2026-09-10", 3)).toBe(400);
    expect(trailingSum([], "revenue", "2026-09-10", 9)).toBe(0);
  });
});

describe("weekOverWeek", () => {
  it("returns relative change, null on zero base", () => {
    const rows: DatedRow[] = [
      { date: "2026-09-01", revenue: 100 },
      { date: "2026-09-08", revenue: 150 },
    ];
    expect(weekOverWeek(rows, "revenue", "2026-09-08")).toBeCloseTo(0.5);
    expect(weekOverWeek([{ date: "2026-09-08", revenue: 50 }], "revenue", "2026-09-08")).toBeNull();
  });
});
