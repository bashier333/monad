import { describe, expect, it } from "vitest";
import {
  MAX_EVAL_STEPS,
  StepBudget,
  collectRefs,
  evaluate,
  evaluateFormula,
  orderFormulas,
  parseFormula,
  roundTo,
} from "@/lib/core/ontology/formulas";

// Formula proof (F2-02451..F2-02600 topics): tokenizer, parser, evaluator,
// step budget, function library, DAG ordering. Errors throw with messages;
// nulls propagate (unknown in, unknown out).

describe("parseFormula", () => {
  it("parses numbers, refs, precedence and calls", () => {
    expect(parseFormula("1 + 2 * 3")).toMatchObject({ kind: "bin", op: "+" });
    expect(parseFormula("max(a, b)")).toMatchObject({ kind: "call", name: "max" });
    expect(parseFormula("-x")).toMatchObject({ kind: "neg" });
    expect(parseFormula("miles").kind).toBe("ref");
  });
  it("rejects bad input loudly", () => {
    expect(() => parseFormula("1 +")).toThrow();
    expect(() => parseFormula("(1")).toThrow();
    expect(() => parseFormula("1 2")).toThrow();
    expect(() => parseFormula("a $ b")).toThrow();
  });
});

describe("evaluate", () => {
  it("computes arithmetic with precedence", () => {
    expect(evaluateFormula("1 + 2 * 3", {})).toBe(7);
    expect(evaluateFormula("(1 + 2) * 3", {})).toBe(9);
    expect(evaluateFormula("10 - 4 / 2", {})).toBe(8);
    expect(evaluateFormula("2 ^ 3", {})).toBe(8);
    expect(evaluateFormula("7 % 3", {})).toBe(1);
  });
  it("resolves refs from context, coercing numeric strings", () => {
    expect(evaluateFormula("revenue - cost", { revenue: 1000, cost: "400" })).toBe(600);
    expect(evaluateFormula("missing + 1", {})).toBeNull();
    expect(() => evaluateFormula("bad + 1", { bad: "nope" })).toThrow(/not numeric/);
  });
  it("runs the function library", () => {
    expect(evaluateFormula("abs(0 - 5)", {})).toBe(5);
    expect(evaluateFormula("round(2.5)", {})).toBe(3);
    expect(evaluateFormula("ceil(2.1)", {})).toBe(3);
    expect(evaluateFormula("floor(2.9)", {})).toBe(2);
    expect(evaluateFormula("min(3, 1, 2)", {})).toBe(1);
    expect(evaluateFormula("max(3, 1, 2)", {})).toBe(3);
    expect(() => evaluateFormula("nope(1)", {})).toThrow(/unknown function/);
  });
  it("nulls propagate through calls and operators", () => {
    expect(evaluateFormula("max(missing, 1)", {})).toBeNull();
    expect(evaluateFormula("-missing", {})).toBeNull();
  });
  it("rejects division by zero and overflow", () => {
    expect(() => evaluateFormula("1 / 0", {})).toThrow(/division by zero/);
    expect(() => evaluateFormula("10 ^ 1000", {})).toThrow(/overflow/);
    expect(() => evaluateFormula("1 ? 2", {})).toThrow();
  });
});

describe("StepBudget", () => {
  it("caps runaway evaluation unconditionally", () => {
    expect(MAX_EVAL_STEPS).toBe(100000);
    const tiny = new StepBudget(3);
    expect(() => evaluate(parseFormula("1 + 2 + 3 + 4"), {}, tiny)).toThrow(/exceeded 3 steps/);
    expect(tiny.spent).toBeGreaterThan(3);
  });
  it("a fresh budget per call isolates batches", () => {
    expect(evaluateFormula("1+1", {})).toBe(2);
    expect(evaluateFormula("1+1", {})).toBe(2);
  });
});

describe("collectRefs + orderFormulas DAG", () => {
  it("collects referenced names, ignoring literals and fn names", () => {
    expect([...collectRefs(parseFormula("max(revenue - cost, 0)"))].sort()).toEqual(["cost", "revenue"]);
    expect([...collectRefs(parseFormula("42"))]).toEqual([]);
  });
  it("topologically orders batches so deps evaluate first", () => {
    const deps = new Map([
      ["margin", new Set(["revenue", "cost"])],
      ["revenue", new Set(["gross"])],
      ["cost", new Set([])],
      ["gross", new Set([])],
    ]);
    const order = orderFormulas(["margin", "revenue", "cost", "gross"], deps);
    expect(order.indexOf("gross")).toBeLessThan(order.indexOf("revenue"));
    expect(order.indexOf("revenue")).toBeLessThan(order.indexOf("margin"));
  });
  it("cycles are a hard error naming the loop", () => {
    const deps = new Map([["a", new Set(["b"])], ["b", new Set(["a"])]]);
    expect(() => orderFormulas(["a", "b"], deps)).toThrow(/cycle detected: a -> b -> a/);
  });
});

describe("roundTo", () => {
  it("rounds to precision without float drift", () => {
    expect(roundTo(2.345, 2)).toBe(2.35);
    expect(roundTo(2.344, 2)).toBe(2.34);
  });
});
