import { describe, expect, it } from "vitest";
import {
  applyBusEvent,
  createBoardBus,
  initialSelectionState,
} from "@/lib/core/boards/selection";
import { applyBoardFilters, normalizeFilters } from "@/lib/core/boards/filters";
import { validateWidgetBoard } from "@/lib/core/boards/widgets";

// Selection bus + filter engine proof (F2-05001+ widget event/filter
// aspects): every bus verb executes with validation, every filter operator
// filters honestly, unknowns are reported.

describe("selection bus events", () => {
  it("selection.set replaces (deduped, capped) and timestamps", () => {
    const r = applyBusEvent(initialSelectionState(), { type: "selection.set", payload: { ids: ["a", "b", "a"] } }, "2026-09-21T00:00:00Z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.selectedIds).toEqual(["a", "b"]);
    expect(r.state.revision).toBe(1);
    expect(r.event.at).toBe("2026-09-21T00:00:00Z");
  });
  it("selection.set rejects non-array ids", () => {
    expect(applyBusEvent(initialSelectionState(), { type: "selection.set", payload: {} }).ok).toBe(false);
  });
  it("filter.set merges; empty values remove", () => {
    let s = initialSelectionState();
    const a = applyBusEvent(s, { type: "filter.set", payload: { key: "region", value: "TX" } });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    s = a.state;
    expect(s.filters).toEqual({ region: "TX" });
    const b = applyBusEvent(s, { type: "filter.set", payload: { key: "region", value: "" } });
    expect(b.ok && b.state.filters).toEqual({});
    expect(applyBusEvent(s, { type: "filter.set", payload: { key: "" } }).ok).toBe(false);
  });
  it("refresh.request bumps revision without touching state", () => {
    const s = { ...initialSelectionState(), selectedIds: ["x"] };
    const r = applyBusEvent(s, { type: "refresh.request" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.selectedIds).toEqual(["x"]);
    expect(r.state.revision).toBe(1);
  });
  it("action.open records pending actions; navigate records href", () => {
    const a = applyBusEvent(initialSelectionState(), { type: "action.open", payload: { actionKey: "mfg_resolve_delay", objectId: "o1" } });
    expect(a.ok && a.state.pendingAction).toMatchObject({ actionKey: "mfg_resolve_delay", objectId: "o1" });
    expect(applyBusEvent(initialSelectionState(), { type: "action.open", payload: {} }).ok).toBe(false);
    const n = applyBusEvent(initialSelectionState(), { type: "navigate", payload: { href: "/ontology/explore?id=o1" } });
    expect(n.ok && n.state.lastNavigation).toBe("/ontology/explore?id=o1");
  });
  it("unknown verbs are rejected, never swallowed", () => {
    const r = applyBusEvent(initialSelectionState(), { type: "teleport", payload: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/unknown bus event/);
  });
});

describe("board bus pub/sub", () => {
  it("publishes to subscribers in order; unsubscribe works", () => {
    const bus = createBoardBus();
    const seen: string[] = [];
    const unsub = bus.subscribe((e) => seen.push(e.type));
    bus.publish({ type: "selection.set", payload: { ids: ["a"] } });
    bus.publish({ type: "teleport", payload: {} });
    unsub();
    bus.publish({ type: "refresh.request" });
    expect(seen).toEqual(["selection.set"]);
    expect(bus.getState().selectedIds).toEqual(["a"]);
    expect(bus.getState().revision).toBe(2);
  });
});

describe("normalizeFilters", () => {
  it("strings become contains, numbers/booleans become eq; empties vanish", () => {
    const { active, ignored } = normalizeFilters({ q: "dal", miles: 100, flag: true, blank: "", nil: null, nope: undefined });
    expect(active.q).toMatchObject({ op: "contains", value: "dal" });
    expect(active.miles).toMatchObject({ op: "eq", value: 100 });
    expect(active.flag).toMatchObject({ op: "eq", value: true });
    expect(active.blank).toBeUndefined();
    expect(ignored).toEqual([]);
  });
  it("bad operators are reported, not applied", () => {
    const { active, ignored } = normalizeFilters({ f: { op: "teleport", value: 1 } as never });
    expect(active.f).toBeUndefined();
    expect(ignored).toEqual(["f"]);
  });
});

describe("applyBoardFilters operators", () => {
  const rows = [
    { lane: "DAL-HOU", miles: 240, active: true },
    { lane: "DAL-ELP", miles: 620, active: false },
    { lane: "HOU-ATL", miles: 780, active: true },
  ];
  it("eq/neq/contains/gte/lte/in all filter honestly", () => {
    expect(applyBoardFilters(rows, { lane: { op: "eq", value: "DAL-HOU" } }).rows).toHaveLength(1);
    expect(applyBoardFilters(rows, { active: { op: "neq", value: true } }).rows).toHaveLength(1);
    expect(applyBoardFilters(rows, { lane: "dal" }).rows).toHaveLength(2);
    expect(applyBoardFilters(rows, { miles: { op: "gte", value: 620 } }).rows).toHaveLength(2);
    expect(applyBoardFilters(rows, { miles: { op: "lte", value: 240 } }).rows).toHaveLength(1);
    expect(applyBoardFilters(rows, { lane: { op: "in", value: ["DAL-HOU"] } }).rows).toHaveLength(1);
  });
  it("non-numeric gte/lte never match; empty filters pass through", () => {
    expect(applyBoardFilters(rows, { lane: { op: "gte", value: 5 } }).rows).toHaveLength(0);
    const pass = applyBoardFilters(rows, {});
    expect(pass.rows).toHaveLength(3);
    expect(pass.ignored).toEqual([]);
  });
  it("unknown fields are reported when the widget declares its fields", () => {
    const out = applyBoardFilters(rows, { nope: "x", lane: "dal" }, new Set(["lane"]));
    expect(out.rows).toHaveLength(2);
    expect(out.ignored).toEqual(["nope"]);
  });
});

describe("board integrity: ids and filter targets", () => {
  it("accepts bound filters and rejects dangling targets + duplicate ids", () => {
    const board = [
      { id: "tbl", type: "object-table", props: { typeKey: "shipment" } },
      { id: "flt", type: "filter-list", props: { targetWidget: "tbl", field: "status" } },
    ];
    expect(validateWidgetBoard(board, "DISPATCHER").ok).toBe(true);
    const dangling = validateWidgetBoard(
      [{ id: "flt", type: "filter-list", props: { targetWidget: "ghost" } }],
      "DISPATCHER",
    );
    expect(dangling.ok).toBe(false);
    expect(dangling.problems[0]!.message).toMatch(/not on this board/);
    const dupes = validateWidgetBoard(
      [
        { id: "x", type: "map", props: {} },
        { id: "x", type: "map", props: {} },
      ],
      "VIEWER",
    );
    expect(dupes.ok).toBe(false);
    expect(dupes.problems[0]!.message).toMatch(/duplicate widget id/);
  });
});

describe("end-to-end filter flow: widget → board gate → bus → engine → rows", () => {
  const rows = [
    { lane: "DAL-HOU", status: "delayed", miles: 240 },
    { lane: "DAL-ELP", status: "planned", miles: 620 },
    { lane: "HOU-ATL", status: "delayed", miles: 780 },
  ];
  it("a bound filter-list narrows the table through the bus", () => {
    const board = [
      { id: "tbl", type: "object-table", props: { typeKey: "shipment" } },
      { id: "flt", type: "filter-list", props: { targetWidget: "tbl", field: "status" } },
    ];
    expect(validateWidgetBoard(board, "DISPATCHER").ok).toBe(true);
    const bus = createBoardBus();
    const published = bus.publish({ type: "filter.set", payload: { key: "status", value: "delayed" } });
    expect(published.ok).toBe(true);
    const out = applyBoardFilters(rows, bus.getState().filters, new Set(["lane", "status", "miles"]));
    expect(out.rows).toHaveLength(2);
    expect(out.ignored).toEqual([]);
    bus.publish({ type: "filter.set", payload: { key: "status", value: "" } });
    expect(applyBoardFilters(rows, bus.getState().filters).rows).toHaveLength(3);
  });
  it("operator-form values (gte objects) flow through the same path", () => {
    const bus = createBoardBus();
    bus.publish({ type: "filter.set", payload: { key: "miles", value: { op: "gte", value: 620 } } });
    const out = applyBoardFilters(rows, bus.getState().filters);
    expect(out.rows).toHaveLength(2);
    bus.publish({ type: "selection.set", payload: { ids: ["DAL-HOU"] } });
    expect(bus.getState().selectedIds).toEqual(["DAL-HOU"]);
  });
});
