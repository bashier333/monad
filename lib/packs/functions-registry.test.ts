import { describe, expect, it } from "vitest";
import {
  executeFunctionSpec,
  functionStats,
  recordFunctionCall,
  resetFunctionMetrics,
  resolveBoardVariable,
  snapshotOf,
  validateFunctionSpec,
  versionNote,
  type FunctionSpec,
} from "@/lib/core/ontology/functions";
import { BUILTIN_FUNCTION_SPECS } from "@/lib/packs/function-specs";
import { packNativeHandlers } from "@/lib/packs/function-handlers";
import { resolveEffect } from "@/lib/core/ontology/execute";

// Function registry proof (F2-02751..F2-03000): spec validation, execution
// across all four kinds, budgets, versions, metrics, board variables and
// $fn-backed action effects. DB persistence (functions-store) follows the
// same tested patterns as registry.ts; pure behavior is executed here.

const FORMULA: FunctionSpec = {
  key: "margin_rollup",
  label: "Margin rollup",
  pure: true,
  budgetMs: 2000,
  kind: "formula",
  code: { expression: "revenue - cost" },
  enabled: true,
};

describe("validateFunctionSpec", () => {
  it("accepts all 13 canonical specs", () => {
    expect(BUILTIN_FUNCTION_SPECS).toHaveLength(13);
    for (const spec of BUILTIN_FUNCTION_SPECS) {
      expect(validateFunctionSpec(spec).ok, spec.key).toBe(true);
    }
  });
  it("rejects bad keys, budgets, and per-kind violations", () => {
    expect(validateFunctionSpec({ ...FORMULA, key: "Bad" }).ok).toBe(false);
    expect(validateFunctionSpec({ ...FORMULA, budgetMs: 5 }).ok).toBe(false);
    expect(validateFunctionSpec({ ...FORMULA, kind: "formula", code: {} }).ok).toBe(false);
    expect(validateFunctionSpec({ ...FORMULA, kind: "formula", code: { expression: "1 +" } }).ok).toBe(false);
    expect(
      validateFunctionSpec({ ...FORMULA, kind: "aggregation", code: { op: "mode", field: "x" } }).ok,
    ).toBe(false);
    expect(
      validateFunctionSpec({ ...FORMULA, kind: "aggregation", code: { op: "avg" } }).ok,
    ).toBe(false);
    expect(
      validateFunctionSpec({ ...FORMULA, kind: "composite", code: { formulas: [] } }).ok,
    ).toBe(false);
    expect(
      validateFunctionSpec({
        ...FORMULA,
        kind: "composite",
        code: { formulas: [{ name: "a", expression: "b + 1" }, { name: "b", expression: "a + 1" }] },
      }).ok,
    ).toBe(false);
    expect(validateFunctionSpec({ ...FORMULA, kind: "native", code: {} }).ok).toBe(false);
    expect(validateFunctionSpec({ ...FORMULA, kind: "nope", code: {} }).ok).toBe(false);
  });
});

describe("executeFunctionSpec: formula + aggregation", () => {
  it("evaluates margin math against caller args", async () => {
    const r = await executeFunctionSpec(FORMULA, { revenue: 1000, cost: "400" });
    expect(r).toMatchObject({ ok: true, value: 600 });
    expect(r.version).toBeNull();
    const pct = await executeFunctionSpec(
      BUILTIN_FUNCTION_SPECS.find((s) => s.key === "margin_percent")!,
      { revenue: 1000, cost: 250 },
    );
    expect(pct.value).toBeCloseTo(75);
  });
  it("aggregates rows; missing rows is a loud error, not a guess", async () => {
    const rows = [{ miles: 100 }, { miles: "200" }, { miles: "bad" }];
    const avg = await executeFunctionSpec(
      BUILTIN_FUNCTION_SPECS.find((s) => s.key === "avg_miles")!,
      { rows },
    );
    expect(avg).toMatchObject({ ok: true, value: 150 });
    const bad = await executeFunctionSpec(
      BUILTIN_FUNCTION_SPECS.find((s) => s.key === "avg_miles")!,
      {},
    );
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/args.rows/);
  });
  it("missing refs propagate null; bad types surface as errors, never throws", async () => {
    const r = await executeFunctionSpec(FORMULA, { revenue: 1 });
    expect(r).toMatchObject({ ok: true, value: null });
    const bad = await executeFunctionSpec(FORMULA, { revenue: "nope", cost: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/not numeric/);
  });
});

describe("executeFunctionSpec: composite DAG", () => {
  const spec: FunctionSpec = {
    key: "comp",
    label: "Comp",
    pure: true,
    budgetMs: 5000,
    kind: "composite",
    code: {
      formulas: [
        { name: "margin", expression: "revenue - cost" },
        { name: "graded", expression: "margin * 2" },
      ],
    },
    enabled: true,
  };
  it("orders deps first and threads outputs", async () => {
    const r = await executeFunctionSpec(spec, { revenue: 100, cost: 30 });
    expect(r).toMatchObject({ ok: true, value: { margin: 70, graded: 140 } });
  });
});

describe("executeFunctionSpec: native via pack handlers", () => {
  it("coverage_days delegates to the pack module", async () => {
    const spec = BUILTIN_FUNCTION_SPECS.find((s) => s.key === "coverage_days")!;
    const r = await executeFunctionSpec(spec, { qtyOnHand: 100, dailyDemand: 10 }, { nativeHandlers: packNativeHandlers });
    expect(r).toMatchObject({ ok: true, value: 10 });
  });
  it("demand_forecast parses history like the agent path", async () => {
    const spec = BUILTIN_FUNCTION_SPECS.find((s) => s.key === "demand_forecast")!;
    const r = await executeFunctionSpec(
      spec,
      { history: [{ weekStart: "2026-08-01", demand: 10 }, { weekStart: "2026-08-08", demand: 20 }] },
      { nativeHandlers: packNativeHandlers },
    );
    expect(r.ok).toBe(true);
    expect((r.value as { point: number }).point).toBeGreaterThan(0);
  });
  it("revenue_match matches above threshold, lists the rest unmatched", async () => {
    const spec = BUILTIN_FUNCTION_SPECS.find((s) => s.key === "revenue_match")!;
    const r = await executeFunctionSpec(
      spec,
      {
        settlements: [{ id: "st-1", reference: "LOAD-100", amount: 500 }],
        loads: [{ load_id: "LOAD-100" }, { load_id: "LOAD-999" }],
      },
      { nativeHandlers: packNativeHandlers },
    );
    expect(r.ok).toBe(true);
    const rows = r.value as Array<{ status: string; matchedLoad: string | null }>;
    expect(rows[0]).toMatchObject({ status: "matched", matchedLoad: "LOAD-100" });
    const r2 = await executeFunctionSpec(
      spec,
      { settlements: [{ id: "st-2", reference: "ZZZ", amount: 10 }], loads: [{ load_id: "LOAD-100" }] },
      { nativeHandlers: packNativeHandlers },
    );
    expect((r2.value as Array<{ status: string }>)[0]!.status).toBe("unmatched");
  });
  it("week_over_week and trailing revenue wrap the aggregation engine", async () => {
    const rows = [
      { date: "2026-09-01", revenue: 100 },
      { date: "2026-09-08", revenue: 150 },
      { date: "2026-09-20", revenue: 300 },
    ];
    const wow = await executeFunctionSpec(
      BUILTIN_FUNCTION_SPECS.find((s) => s.key === "week_over_week")!,
      { rows, field: "revenue", weekStart: "2026-09-08" },
      { nativeHandlers: packNativeHandlers },
    );
    expect(wow.value).toBeCloseTo(0.5);
    const trail = await executeFunctionSpec(
      BUILTIN_FUNCTION_SPECS.find((s) => s.key === "trailing_revenue_30d")!,
      { rows, field: "revenue", endDate: "2026-09-20" },
      { nativeHandlers: packNativeHandlers },
    );
    expect(trail.value).toBe(550);
  });
  it("unknown handlers and slow handlers fail loudly", async () => {
    const spec = BUILTIN_FUNCTION_SPECS.find((s) => s.key === "coverage_days")!;
    const unknown = await executeFunctionSpec(spec, {}, { nativeHandlers: {} });
    expect(unknown.ok).toBe(false);
    expect(unknown.error).toMatch(/unknown native handler/);
    const slow: FunctionSpec = { ...spec, budgetMs: 20 };
    const timed = await executeFunctionSpec(slow, {}, {
      nativeHandlers: { coverage_days: async () => new Promise((r) => setTimeout(() => r(1), 200)) },
    });
    expect(timed.ok).toBe(false);
    expect(timed.error).toMatch(/budget/);
  });
  it("same inputs give byte-identical outputs", async () => {
    const spec = BUILTIN_FUNCTION_SPECS.find((s) => s.key === "margin_rollup")!;
    const a = await executeFunctionSpec(spec, { revenue: 5, cost: 2 });
    const b = await executeFunctionSpec(spec, { revenue: 5, cost: 2 });
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
  });
});

describe("versions: snapshots and notes", () => {
  it("snapshot round-trips; notes name changed fields", () => {
    const snap = snapshotOf(FORMULA);
    expect(validateFunctionSpec(snap).ok).toBe(true);
    expect(versionNote(null, snap)).toBe("initial version");
    expect(versionNote(snap, { ...snap, label: "New" })).toMatch(/label/);
    expect(versionNote(snap, snap)).toBe("no changes");
  });
});

describe("metrics ring", () => {
  it("records calls and ranks latency honestly", () => {
    resetFunctionMetrics();
    recordFunctionCall("k", true, 10);
    recordFunctionCall("k", false, 30);
    recordFunctionCall("k", true, 20);
    expect(functionStats("k")).toMatchObject({ calls: 3, fails: 1, p50: 20, p95: 30 });
    expect(functionStats("missing")).toMatchObject({ calls: 0, fails: 0, p50: 0, p95: 0 });
    resetFunctionMetrics();
  });
});

describe("resolveBoardVariable", () => {
  it("wraps values with timestamp; errors stay visible", async () => {
    const ok = await resolveBoardVariable(FORMULA, { revenue: 10, cost: 4 });
    expect(ok.value).toBe(6);
    expect(typeof ok.evaluatedAt).toBe("string");
    const bad = await resolveBoardVariable(FORMULA, { revenue: "nope", cost: 1 });
    expect(bad.value).toBeNull();
    expect(bad.error).toMatch(/not numeric/);
  });
});

describe("$fn-backed action effects", () => {
  it("resolves $fn refs from pre-computed values; missing reported, never nulled silently", () => {
    const effect = { kind: "set", property: "miles", value: "$fn.margin_rollup" } as never;
    const ok = resolveEffect(effect, {}, { margin_rollup: 600 });
    expect(ok.value).toMatchObject({ value: 600 });
    expect(ok.missing).toEqual([]);
    const missing = resolveEffect(effect, {}, {});
    expect(missing.value).toBeNull();
    expect(missing.missing).toEqual(["$fn.margin_rollup"]);
    // Paths without fnValues behave exactly as before.
    const plain = resolveEffect({ kind: "set", property: "miles", value: "$inputs.miles" } as never, { miles: 5 });
    expect(plain.value).toMatchObject({ value: 5 });
  });
});
