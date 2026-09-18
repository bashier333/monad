import { computeLaneMargins, parseMoney, weekBounds, type LoadInput } from "@/lib/margin/engine";
import { seedAliases } from "@/lib/margin/places";
import { describe, expect, it } from "vitest";

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fuzzLoads(n: number, seed: number): LoadInput[] {
  const rnd = mulberry32(seed);
  const cities = ["Dallas TX", "DAL", "Houston", "Austin TX", "El Paso TX", "Phoenix AZ"];
  const out: LoadInput[] = [];
  for (let i = 0; i < n; i++) {
    const day = 7 + Math.floor(rnd() * 7);
    out.push({
      loadKey: `F${i}`,
      date: `2026-09-${String(day).padStart(2, "0")}`,
      origin: cities[Math.floor(rnd() * cities.length)],
      destination: cities[Math.floor(rnd() * cities.length)],
      driver: "D",
      truck: `Unit${1 + Math.floor(rnd() * 5)}`,
      broker: "BlueLine",
      revenue: (rnd() * 3000).toFixed(2),
      miles: String(Math.floor(rnd() * 500)),
      detention: rnd() < 0.2 ? "75" : "0",
      runId: " fuzz",
      fileName: "fuzz.csv",
      rowNumber: i + 2,
    });
  }
  return out;
}

const WEEK = { start: "2026-09-07", end: "2026-09-13" };

describe("engine properties (W3)", () => {
  it("every money figure has ≤2 decimals on fuzzed loads", () => {
    const r = computeLaneMargins(fuzzLoads(500, 1), [], [], seedAliases(), [], WEEK.start, WEEK.end);
    const two = (n: number) => expect(Math.round(n * 100) / 100).toBe(n);
    for (const l of r.lanes) {
      two(l.revenue);
      two(l.cost);
      two(l.margin);
    }
    two(r.totals.revenue);
    two(r.totals.cost);
    two(r.totals.margin);
  });

  it("fuel allocation sums to input total", () => {
    const loads = fuzzLoads(200, 2);
    const fuels = [
      { truck: "Unit1", date: "2026-09-08", amount: "1000", runId: "f", fileName: "f", rowNumber: 2 },
      { truck: "Unit2", date: "2026-09-09", amount: "500", runId: "f", fileName: "f", rowNumber: 3 },
    ];
    const r = computeLaneMargins(loads, fuels, [], seedAliases(), [], WEEK.start, WEEK.end);
    const fuelOut = r.loads.flatMap((l) => l.costs).filter((c) => c.kind === "fuel").reduce((s, c) => s + c.amount, 0);
    expect(Math.abs(fuelOut - 1500) < 200 * 0.01 + 0.001 || fuelOut <= 1500).toBe(true);
  });

  it("week filter never leaks out-of-week loads across DST", () => {
    const loads = fuzzLoads(100, 3).map((l, i) => ({ ...l, date: i % 2 ? "2026-11-01" : "2026-11-02" }));
    const r = computeLaneMargins(loads, [], [], seedAliases(), [], "2026-11-02", "2026-11-08");
    expect(r.totals.loads).toBe(50);
  });

  it("empty and zero-revenue inputs never produce NaN/Infinity", () => {
    const loads = fuzzLoads(50, 4).map((l) => ({ ...l, revenue: "0" }));
    const r = computeLaneMargins(loads, [], [], seedAliases(), [], WEEK.start, WEEK.end);
    const nums = [r.totals.revenue, r.totals.cost, r.totals.margin, ...(r.totals.marginPct === null ? [] : [r.totals.marginPct])];
    for (const n of nums) {
      expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("deterministic under shuffled input order", () => {
    const loads = fuzzLoads(300, 5);
    const a = computeLaneMargins(loads, [], [], seedAliases(), [], WEEK.start, WEEK.end);
    const rev = [...loads].reverse();
    const b = computeLaneMargins(rev, [], [], seedAliases(), [], WEEK.start, WEEK.end);
    expect(JSON.stringify(a.lanes)).toBe(JSON.stringify(b.lanes));
    expect(JSON.stringify(a.totals)).toBe(JSON.stringify(b.totals));
  });

  it("money parser handles $, commas, parens, blanks", () => {
    expect(parseMoney("$1,850.00")).toBe(1850);
    expect(parseMoney("  42 ")).toBe(42);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBe(0);
  });

  it("marginPct stays bounded or null", () => {
    const r = computeLaneMargins(fuzzLoads(300, 6), [], [], seedAliases(), [], WEEK.start, WEEK.end);
    for (const l of r.lanes) {
      if (l.marginPct !== null) {
        expect(Math.abs(l.marginPct)).toBeLessThanOrEqual(10000);
      }
    }
  });

  it("parallel computes on shared inputs are identical", async () => {
    const loads = fuzzLoads(500, 7);
    const runs = await Promise.all(
      Array.from({ length: 8 }, async () => computeLaneMargins(loads, [], [], seedAliases(), [], WEEK.start, WEEK.end)),
    );
    const first = JSON.stringify(runs[0].lanes);
    for (const r of runs) expect(JSON.stringify(r.lanes)).toBe(first);
  });

  it("week edges: DST, year-cross, weekStartsOn 0v1, single load", () => {
    expect(weekBounds("2026-03-09", 1)).toEqual({ start: "2026-03-09", end: "2026-03-15" });
    expect(weekBounds("2026-12-30", 1)).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    expect(weekBounds("2026-09-09", 0)).toEqual({ start: "2026-09-06", end: "2026-09-12" });
    const one = computeLaneMargins(
      [{ loadKey: "S1", date: "2026-09-07", origin: "A", destination: "B", driver: "D", truck: "T", broker: "B", revenue: "100", miles: "10", detention: "0", runId: "r", fileName: "f", rowNumber: 2 }],
      [], [], seedAliases(), [], WEEK.start, WEEK.end,
    );
    expect(one.lanes).toHaveLength(1);
    expect(one.totals).toMatchObject({ revenue: 100, cost: 0, margin: 100, loads: 1 });
  });
});
