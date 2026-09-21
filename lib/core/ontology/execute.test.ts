import { describe, expect, it } from "vitest";
import { resolveEffect, resolveRef } from "@/lib/core/ontology/execute";
import type { ActionEffect } from "@/lib/core/ontology/actions";

describe("action input resolution (MFG-0101)", () => {
  it("resolves $inputs.* string refs", () => {
    expect(resolveRef("$inputs.qty", { qty: 5 })).toEqual({ ok: true, value: 5 });
    expect(resolveRef("$inputs.missing", {})).toEqual({ ok: false, value: null });
  });

  it("resolves $input marker objects", () => {
    expect(resolveRef({ $input: "qty" }, { qty: 7 })).toEqual({ ok: true, value: 7 });
    expect(resolveRef({ $input: "missing" }, {})).toEqual({ ok: false, value: null });
  });

  it("skips set effects whose input is absent", () => {
    const e: ActionEffect = { kind: "set", property: "reorderPoint", value: "$inputs.reorderPoint" };
    const r = resolveEffect(e, {});
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(["$inputs.reorderPoint"]);
    const r2 = resolveEffect(e, { reorderPoint: 80 });
    expect(r2.value).toEqual({ kind: "set", property: "reorderPoint", value: 80 });
    expect(r2.missing).toEqual([]);
  });

  it("skips link effects with absent targets", () => {
    const e: ActionEffect = { kind: "link", linkKey: "mfg_dest_customer", targetId: "$inputs.destCustomerId" };
    const r = resolveEffect(e, {});
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(["$inputs.destCustomerId"]);
  });

  it("deep-resolves create data and drops absent fields", () => {
    const e: ActionEffect = {
      kind: "create",
      typeKey: "mfg_shipment",
      data: { key: "$inputs.shipmentKey", status: "planned", carrier: "$inputs.carrier", qty: "$inputs.qty" },
    };
    const r = resolveEffect(e, { shipmentKey: "sh-1", qty: 10 });
    expect(r.value).toEqual({ kind: "create", typeKey: "mfg_shipment", data: { key: "sh-1", status: "planned", qty: 10 } });
    expect(r.missing).toEqual(["$inputs.carrier"]);
  });

  it("passes static effects through", () => {
    const e: ActionEffect = { kind: "set", property: "status", value: "producing" };
    const r = resolveEffect(e, {});
    expect(r.value).toEqual(e);
    expect(r.missing).toEqual([]);
  });

  it("resolves targeted set targetIds (MFG-0102)", () => {
    const e: ActionEffect = {
      kind: "set",
      property: "qty_on_hand",
      value: "$inputs.targetAfter",
      targetId: "$inputs.toLotId",
    };
    const r = resolveEffect(e, { targetAfter: 910, toLotId: "lot-9" });
    expect(r.value).toEqual({ kind: "set", property: "qty_on_hand", value: 910, targetId: "lot-9" });
    expect(r.missing).toEqual([]);
    const r2 = resolveEffect(e, { targetAfter: 910 });
    expect(r2.value).toBeNull();
    expect(r2.missing).toEqual(["$inputs.toLotId"]);
  });
});
