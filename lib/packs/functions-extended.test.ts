import { describe, expect, it } from "vitest";
import { executeFunctionSpec, validateFunctionSpec } from "@/lib/core/ontology/functions";
import { EXTENDED_FUNCTION_SPECS } from "@/lib/packs/function-specs";
import { allNativeHandlers } from "@/lib/packs/function-handlers";

// Extended registry proof (fn7, fn8, fn10–fn40 + revenue_match tail):
// every spec validates; every handler executes on representative args with
// loud, specific errors on bad input. Deterministic: same args, same bytes.

async function run(key: string, args: Record<string, unknown>) {
  const spec = EXTENDED_FUNCTION_SPECS.find((s) => s.key === key)!;
  return executeFunctionSpec(spec, args, { nativeHandlers: allNativeHandlers });
}

describe("extended specs validate", () => {
  it("all 33 extended specs pass validation", () => {
    expect(EXTENDED_FUNCTION_SPECS).toHaveLength(33);
    for (const spec of EXTENDED_FUNCTION_SPECS) {
      expect(validateFunctionSpec(spec).ok, spec.key).toBe(true);
    }
  });
  it("every native spec names a registered handler", () => {
    for (const spec of EXTENDED_FUNCTION_SPECS) {
      if (spec.kind !== "native") continue;
      const handler = (spec.code as { handler: string }).handler;
      expect(allNativeHandlers[handler], spec.key).toBeTypeOf("function");
    }
  });
});

describe("drivers + anomalies", () => {
  it("top_drivers ranks worst margins first with loss shares", async () => {
    const r = await run("top_drivers", {
      rows: [
        { lane: "A", margin: 100 },
        { lane: "B", margin: -50 },
        { lane: "C", margin: -150 },
        { lane: "D", margin: 20 },
      ],
    });
    expect(r.ok).toBe(true);
    const rows = r.value as Array<{ lane: string; shareOfLoss: number }>;
    expect(rows.map((x) => x.lane)).toEqual(["C", "B", "D"]);
    expect(rows[0]!.shareOfLoss).toBeCloseTo(0.75);
  });
  it("anomaly_flag fires past threshold, spares the rest", async () => {
    const r = await run("anomaly_flag", {
      current: [{ key: "k1", value: 150 }, { key: "k2", value: 102 }],
      previous: [{ key: "k1", value: 100 }, { key: "k2", value: 100 }],
      thresholdPct: 20,
    });
    expect(r.ok).toBe(true);
    expect(r.value as unknown[]).toHaveLength(1);
    expect((r.value as Array<{ key: string }>)[0]!.key).toBe("k1");
  });
});

describe("cost attribution", () => {
  it("cost_attribute directs and pro-ratas honestly", async () => {
    const r = await run("cost_attribute", {
      costs: [
        { kind: "detention", amount: 150, load: "L1" },
        { kind: "overhead", amount: 100 },
      ],
      loads: [{ key: "L1", weight: 1 }, { key: "L2", weight: 3 }],
    });
    expect(r.ok).toBe(true);
    const lines = r.value as Array<{ load: string; total: number }>;
    expect(lines.find((l) => l.load === "L1")!.total).toBe(175);
    expect(lines.find((l) => l.load === "L2")!.total).toBe(75);
  });
  it("deadhead_split attributes empty miles to the causing lane", async () => {
    const r = await run("deadhead_split", { emptyMiles: 60, causedByLoad: "L9" });
    expect(r.value).toMatchObject({ attributedTo: "L9", emptyMiles: 60 });
    expect((await run("deadhead_split", { emptyMiles: -1, causedByLoad: "L9" })).ok).toBe(false);
  });
  it("overhead_split pro-ratas by revenue, equal-splits on zero", async () => {
    const r = await run("overhead_split", {
      overhead: 100,
      loads: [{ key: "A", revenue: 300 }, { key: "B", revenue: 100 }],
    });
    const rows = r.value as Array<{ load: string; share: number; basis: string }>;
    expect(rows.find((x) => x.load === "A")!.share).toBe(75);
    expect(rows[0]!.basis).toBe("pro-rata-revenue");
  });
});

describe("matching + normalization", () => {
  it("settlement_fuzzy ranks all candidates by score", async () => {
    const r = await run("settlement_fuzzy", {
      settlements: [{ id: "s1", reference: "LOAD-100" }],
      loads: [{ load_id: "LOAD-100" }, { load_id: "LOAD-101" }],
    });
    const cands = (r.value as Array<{ candidates: Array<{ load: string; score: number }> }>)[0]!.candidates;
    expect(cands[0]).toMatchObject({ load: "LOAD-100", score: 1 });
    expect(cands.length).toBe(2);
  });
  it("lane_normalize uppercases and applies aliases", async () => {
    const r = await run("lane_normalize", {
      origin: "  Dallas TX ",
      destination: "dal",
      aliases: { dal: "DALLAS TX" },
    });
    expect(r.value).toMatchObject({ lane: "DALLAS TX-DALLAS TX" });
    expect((await run("lane_normalize", { origin: "", destination: "x" })).ok).toBe(false);
  });
  it("place_alias resolves canonical names", async () => {
    expect((await run("place_alias", { name: "DAL", aliases: { dal: "Dallas TX" } })).value).toBe("Dallas TX");
    expect((await run("place_alias", { name: "Nowhere" })).value).toBe("Nowhere");
  });
  it("duplicate/identity scores share the tested matcher", async () => {
    const d = await run("duplicate_score", { a: "Acme Freight", b: "Acme Freigh" });
    expect(d.value).toMatchObject({ class: "auto" });
    const i = await run("identity_score", { a: "Acme", b: "Acme" });
    expect(i.value).toMatchObject({ score: 1 });
  });
  it("merge_plan separates keep/fill/conflicts", async () => {
    const r = await run("merge_plan", { a: { x: "1", y: "same" }, b: { y: "same", z: "new", x: "2" } });
    expect(r.value).toMatchObject({ keep: [], fill: ["z"], conflicts: [{ field: "x", a: "1", b: "2" }] });
  });
});

describe("scores + verdicts share one scale", () => {
  it("risk_score mirrors the lender 2–98 scale", async () => {
    expect((await run("risk_score", { flags: [{ severity: "critical" }] })).value).toBe(58);
    expect((await run("risk_score", { flags: [] })).value).toBe(88);
  });
  it("verdict_score uses the same FUND/REVIEW/KILL lines", async () => {
    expect((await run("verdict_score", { score: 80 })).value).toMatchObject({ verdict: "FUND" });
    expect((await run("verdict_score", { score: 50 })).value).toMatchObject({ verdict: "REVIEW" });
    expect((await run("verdict_score", { score: 10 })).value).toMatchObject({ verdict: "KILL" });
  });
  it("fuse/dedupe reuse the livedata pipeline", async () => {
    const flags = [
      { text: "Registry dissolved", source: "OC", severity: "critical" },
      { text: "Registry dissolved", source: "OC", severity: "critical" },
    ];
    const d = await run("dedupe_flags", { flags });
    expect((d.value as unknown[]).length).toBe(1);
    const f = await run("fuse_flags", { flags });
    expect(f.ok).toBe(true);
  });
});

describe("brief + viz builders delegate, never duplicate", () => {
  const overview = {
    counts: { lots: 2, plants: 1, warehouses: 1, customers: 1 },
    coverage: [{ id: "1", key: "l1", coverageDays: 5, belowReorderPoint: true }],
    reorder: [],
    risks: [],
    shipments: [],
    atRiskLots: 1,
    delayedShipments: 0,
  };
  it("brief_build renders the pack sentences from twin input", async () => {
    const r = await run("brief_build", { overview, weekStart: "2026-09-01", weekEnd: "2026-09-07" });
    expect(r.ok).toBe(true);
    expect(((r.value as { parts: string[] }).parts.join(" "))).toMatch(/Week of 2026-09-01/);
  });
  it("brief_variant scopes notes per region", async () => {
    const base = await run("brief_build", { overview, weekStart: "2026-09-01", weekEnd: "2026-09-07" });
    const r = await run("brief_variant", {
      overview,
      base: base.value,
      nodes: [{ id: "n1", type: "plant", label: "Dallas Plant", region: "Texas" }],
    });
    expect(r.ok).toBe(true);
    expect((r.value as { variants: Array<{ key: string }> }).variants[0]!.key).toBe("Texas");
  });
  it("chart_series sorts points; map_points validates coords", async () => {
    const c = await run("chart_series", {
      rows: [{ date: "2026-09-02", revenue: 2 }, { date: "2026-09-01", revenue: 1 }],
      x: "date",
      y: "revenue",
    });
    expect(c.value).toEqual([{ x: "2026-09-01", y: 1 }, { x: "2026-09-02", y: 2 }]);
    const m = await run("map_points", {
      nodes: [{ label: "A", lat: 32.7, lng: -96.8 }, { label: "B", lat: 999, lng: 0 }],
    });
    expect(m.value).toMatchObject({ skipped: 1 });
    expect(((m.value as { points: unknown[] }).points)).toHaveLength(1);
  });
});

describe("graph + scenario + governance helpers", () => {
  it("graph_rank and path_find wrap the tested engine", async () => {
    const edges = [
      { fromId: "a", linkKey: "l", toId: "b" },
      { fromId: "a", linkKey: "l", toId: "c" },
      { fromId: "b", linkKey: "l", toId: "c" },
    ];
    const rank = await run("graph_rank", { edges, limit: 2 });
    expect((rank.value as Array<{ id: string }>)[0]!.id).toBe("a");
    expect(await run("path_find", { edges, from: "a", to: "c" })).toMatchObject({ ok: true, value: ["a", "c"] });
    expect((await run("path_find", { edges, from: "c", to: "a" })).value).toBeNull();
  });
  it("impact_sim runs the pack simulation on explicit inputs", async () => {
    const r = await run("impact_sim", {
      lots: [{ id: "l1", key: "l1", data: { qty_on_hand: 10, reorder_point: 20, daily_demand: 5 } }],
      changes: [{ objectId: "l1", data: { qty_on_hand: 100 } }],
    });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ affected: 1 });
  });
  it("scenario_diff lists field changes both ways", async () => {
    const r = await run("scenario_diff", { before: { a: 1, b: 2 }, after: { a: 1, b: 3, c: 4 } });
    expect(r.value).toEqual([
      { field: "b", before: 2, after: 3 },
      { field: "c", before: null, after: 4 },
    ]);
  });
  it("approval_quorum counts unique approvers", async () => {
    expect((await run("approval_quorum", { approvals: ["u1", "u1", "u2"], requiredCount: 2 })).value).toMatchObject({ reached: true, unique: 2 });
    expect((await run("approval_quorum", { approvals: ["u1"], requiredCount: 2 })).value).toMatchObject({ reached: false });
  });
  it("notify_list filters by role; webhook_params fills templates", async () => {
    const n = await run("notify_list", {
      members: [{ userId: "o1", role: "OWNER" }, { userId: "v1", role: "VIEWER" }],
      roles: ["OWNER"],
    });
    expect(n.value).toEqual(["o1"]);
    const w = await run("webhook_params", {
      template: { url: "https://x.test/{{lane}}", note: "hi" },
      data: { lane: "DAL-HOU" },
    });
    expect(w.value).toMatchObject({ url: "https://x.test/DAL-HOU" });
  });
});

describe("norm + eval + trace utilities", () => {
  it("currency_norm rounds without converting", async () => {
    expect((await run("currency_norm", { amount: 19.999, currency: "usd" })).value).toMatchObject({ amount: 20, currency: "USD" });
    expect((await run("currency_norm", { amount: 1, currency: "XX" })).ok).toBe(false);
  });
  it("unit_norm converts mi<->km with documented constants", async () => {
    expect((await run("unit_norm", { value: 10, from: "mi", to: "km" })).value).toMatchObject({ value: 16.09 });
    expect((await run("unit_norm", { value: 10, from: "mi", to: "mi" })).value).toMatchObject({ value: 10 });
    expect((await run("unit_norm", { value: 1, from: "mi", to: "parsec" })).ok).toBe(false);
  });
  it("week_bounds honors Sunday/Monday starts", async () => {
    expect((await run("week_bounds", { date: "2026-09-23", weekStartsOn: 1 })).value).toMatchObject({
      weekStart: "2026-09-21",
      weekEnd: "2026-09-27",
    });
  });
  it("freshness_check mirrors the connector badge states", async () => {
    const now = Date.now();
    expect((await run("freshness_check", { lastPulledAt: new Date(now - 1000).toISOString(), slaMs: 3600000, nowMs: now })).value).toMatchObject({ state: "fresh" });
    expect((await run("freshness_check", { slaMs: 1000, nowMs: now })).value).toMatchObject({ state: "never" });
  });
  it("eval_metric scores exact and tolerance judgments", async () => {
    expect((await run("eval_metric", { expected: "a", actual: "a", kind: "exact" })).value).toMatchObject({ pass: true, score: 1 });
    expect((await run("eval_metric", { expected: 100, actual: 101, kind: "tolerance", tolerance: 2 })).value).toMatchObject({ pass: true });
    expect((await run("eval_metric", { expected: 100, actual: 200, kind: "tolerance", tolerance: 2 })).value).toMatchObject({ pass: false });
  });
  it("trace_link points at the explorer", async () => {
    const r = await run("trace_link", { runId: "run-1", objectIds: ["o1", "o2"] });
    expect(r.value).toMatchObject({ traceId: "run-1" });
    expect(((r.value as { links: Array<{ href: string }> }).links[0]!.href)).toContain("/ontology/explore?id=o1");
  });
  it("derived_metric composes a*b+c deterministically", async () => {
    const spec = { key: "derived_metric", label: "Derived", pure: true, budgetMs: 2000, kind: "formula" as const, code: { expression: "a * b + c" }, enabled: true };
    const { executeFunctionSpec } = await import("@/lib/core/ontology/functions");
    const a = await executeFunctionSpec(spec, { a: 2, b: 3, c: 4 });
    const b = await executeFunctionSpec(spec, { a: 2, b: 3, c: 4 });
    expect(a.value).toBe(10);
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
  });
});
