import { describe, expect, it } from "vitest";
import { describeActionForm, validateActionInputs } from "@/lib/core/boards/action-forms";
import { buildBoardAgentQuery, filterAgentContext } from "@/lib/core/boards/agent-query";
import { initialSelectionState } from "@/lib/core/boards/selection";
import type { ActionDef } from "@/lib/core/ontology/actions";

// Event + AIP widget contracts proof (F2-08001+ families): forms derive
// from definitions, agent queries scope to board state.

const DEF = {
  key: "mfg_transfer_stock",
  label: "Transfer stock",
  targetTypeKey: "mfg_inventory_lot",
  inputs: {},
  effects: [
    { kind: "set", property: "qty_on_hand", value: "$inputs.qty" },
    { kind: "link", linkKey: "mfg_stocks", targetId: "$inputs.destWarehouseId" },
    { kind: "set", property: "note", value: { $input: "reason" } },
    { kind: "set", property: "computed", value: "$fn.margin_rollup" },
  ],
  approvalPolicy: "single",
  requiredCount: 1,
} as unknown as ActionDef;

describe("describeActionForm", () => {
  it("derives one field per $inputs ref; $fn refs are not user fields", () => {
    const fields = describeActionForm(DEF);
    expect(fields.map((f) => f.name).sort()).toEqual(["destWarehouseId", "qty", "reason"]);
    expect(fields.find((f) => f.name === "qty")?.kind).toBe("number");
    expect(fields.find((f) => f.name === "destWarehouseId")?.kind).toBe("object");
    expect(fields.find((f) => f.name === "reason")?.kind).toBe("textarea");
    expect(fields.every((f) => f.required)).toBe(true);
  });
  it("actions without inputs yield zero fields", () => {
    expect(describeActionForm({ ...DEF, effects: [{ kind: "set", property: "x", value: 1 }] })).toEqual([]);
  });
});

describe("validateActionInputs", () => {
  it("requires every derived field; numbers must parse", () => {
    expect(validateActionInputs(DEF, {}).ok).toBe(false);
    expect(validateActionInputs(DEF, {}).errors).toHaveLength(3);
    const bad = validateActionInputs(DEF, { qty: "lots", destWarehouseId: "w1", reason: "ok" });
    expect(bad.ok).toBe(false);
    expect(bad.errors[0]!.field).toBe("qty");
    expect(validateActionInputs(DEF, { qty: 5, destWarehouseId: "w1", reason: "ok" })).toMatchObject({ ok: true, errors: [] });
  });
});

describe("buildBoardAgentQuery", () => {
  it("scopes questions to selection + filters + widgets", () => {
    const state = { ...initialSelectionState(), selectedIds: ["a", "b"], filters: { status: "delayed" } };
    const r = buildBoardAgentQuery(state, ["map", "timeline", "map"], "Which lots need reordering?");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.query.scope).toMatchObject({ selectedIds: ["a", "b"], filters: { status: "delayed" }, widgetTypes: ["map", "timeline"] });
    expect(r.query.typeKeys).toBeUndefined();
    const typed = buildBoardAgentQuery(state, [], "q?", ["mfg_inventory_lot", "mfg_inventory_lot"]);
    expect(typed.ok && typed.query.typeKeys).toEqual(["mfg_inventory_lot"]);
  });
  it("rejects empty and oversized questions", () => {
    const state = initialSelectionState();
    expect(buildBoardAgentQuery(state, [], " ").ok).toBe(false);
    expect(buildBoardAgentQuery(state, [], "x".repeat(2001)).ok).toBe(false);
  });
});

describe("filterAgentContext", () => {
  const ctx = {
    nodes: [
      { id: "a", key: "a", type: "t", data: {} },
      { id: "b", key: "b", type: "t", data: {} },
    ],
    types: [],
    truncated: true,
  };
  it("narrows to the selection; empty keeps all; unknown selects none", () => {
    expect(filterAgentContext(ctx, ["a"]).nodes.map((n) => n.id)).toEqual(["a"]);
    expect(filterAgentContext(ctx, []).nodes).toHaveLength(2);
    expect(filterAgentContext(ctx, ["ghost"]).nodes).toHaveLength(0);
    expect(filterAgentContext(ctx, ["a"]).truncated).toBe(true);
  });
});
