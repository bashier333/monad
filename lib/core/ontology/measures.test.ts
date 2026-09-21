import { describe, expect, it } from "vitest";
import {
  collectRefs,
  evaluate,
  orderFormulas,
  parseFormula,
  roundTo,
  StepBudget,
  evaluateFormula,
} from "@/lib/core/ontology/formulas";
import { avg, distinctCount, groupBy, median, sum, trailingSum, weekOverWeek } from "@/lib/core/ontology/aggregations";

describe("ontology formulas (ONT-0401-0420)", () => {
  it("evaluates arithmetic with precedence", () => {
    expect(evaluateFormula("revenue - cost", { revenue: 100, cost: 30 })).toBe(70);
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
    expect(evaluateFormula("2 ^ 3", {})).toBe(8);
    expect(evaluateFormula("-margin + 10", { margin: 4 })).toBe(6);
  });
  it("guards division by zero and nulls", () => {
    expect(() => evaluateFormula("a / b", { a: 1, b: 0 })).toThrow("division by zero");
    expect(evaluateFormula("a + b", { a: 1, b: null })).toBeNull();
    expect(evaluateFormula("a + b", { a: 1 })).toBeNull();
  });
  it("rejects bad refs and functions", () => {
    expect(() => evaluateFormula("a + b", { a: "x", b: 1 })).toThrow("not numeric");
    expect(() => evaluateFormula("nope(1)", {})).toThrow("unknown function");
    expect(() => evaluateFormula("1 +", {})).toThrow();
    expect(() => evaluateFormula("(1", {})).toThrow();
  });
  it("runs builtin functions", () => {
    expect(evaluateFormula("round(margin_pct)", { margin_pct: 12.6 })).toBe(13);
    expect(evaluateFormula("max(a, b, 10)", { a: 3, b: 30 })).toBe(30);
    expect(evaluateFormula("abs(a)", { a: -4 })).toBe(4);
    expect(roundTo(12.345, 2)).toBe(12.35);
  });
  it("parses the margin formula end to end", () => {
    const node = parseFormula("(revenue - cost) / revenue * 100");
    expect(node.kind).toBe("bin");
    expect(evaluateFormula("(revenue - cost) / revenue * 100", { revenue: 200, cost: 150 })).toBe(25);
  });
  it("guards exponent overflow and step budgets (MFG-0401)", () => {
    expect(() => evaluateFormula("10 ^ 10 ^ 10", {})).toThrow("exponent overflow");
    const budget = new StepBudget(3);
    expect(() => evaluate(parseFormula("1 + 2 + 3 + 4"), {}, budget)).toThrow("exceeded 3 steps");
    expect(budget.spent).toBeGreaterThan(3);
  });
  it("collects refs and orders formula batches acyclically (MFG-0402)", () => {
    expect([...collectRefs(parseFormula("a + max(b, 2)"))].sort()).toEqual(["a", "b"]);
    const deps = new Map([
      ["margin", new Set(["revenue", "cost"])],
      ["margin_pct", new Set(["margin", "revenue"])],
      ["revenue", new Set<string>()],
      ["cost", new Set<string>()],
    ]);
    expect(orderFormulas(["margin_pct", "margin", "revenue", "cost"], deps)).toEqual([
      "revenue",
      "cost",
      "margin",
      "margin_pct",
    ]);
    const cyclic = new Map([
      ["a", new Set(["b"])],
      ["b", new Set(["a"])],
    ]);
    expect(() => orderFormulas(["a", "b"], cyclic)).toThrow("formula cycle detected: a -> b -> a");
  });
});

describe("ontology aggregations (ONT-0421-0445)", () => {
  const rows = [
    { lane: "A", margin: 100, date: "2026-09-07" },
    { lane: "A", margin: 200, date: "2026-09-08" },
    { lane: "B", margin: 50, date: "2026-09-08" },
  ];
  it("groups and sums", () => {
    const groups = groupBy(rows, (r) => String(r.lane));
    expect(groups.size).toBe(2);
    expect(sum(groups.get("A")!, "margin")).toBe(300);
    expect(avg(groups.get("B")!, "margin")).toBe(50);
    expect(median(rows, "margin")).toBe(100);
    expect(distinctCount(rows, "lane")).toBe(2);
  });
  it("handles empty sets", () => {
    expect(avg([], "margin")).toBeNull();
    expect(median([], "margin")).toBeNull();
  });
  it("computes trailing windows and week-over-week", () => {
    expect(trailingSum(rows, "margin", "2026-09-08", 7)).toBe(350);
    expect(trailingSum(rows, "margin", "2026-01-01", 7)).toBe(0);
    const withHistory = [
      ...rows.map((r) => ({ ...r })),
      { lane: "A", margin: 1400, date: "2026-08-31" },
    ];
    const wow = weekOverWeek(withHistory, "margin", "2026-09-07");
    expect(wow).toBeCloseTo((350 - 1400) / 1400, 5);
    expect(weekOverWeek(rows, "margin", "2026-09-07")).toBeNull();
  });
});
