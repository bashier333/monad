import { describe, expect, it } from "vitest";
import { fulfillmentRisks, type ShipmentLite } from "@/lib/packs/manufacturing/logic/risk";

function adj(entries: Array<[string, string, string]>): Map<string, Array<{ fromId: string; linkKey: string; toId: string }>> {
  const m = new Map<string, Array<{ fromId: string; linkKey: string; toId: string }>>();
  for (const [from, link, to] of entries) {
    const list = m.get(from) ?? [];
    list.push({ fromId: from, linkKey: link, toId: to });
    m.set(from, list);
  }
  return m;
}

function shipment(id: string, status: string, qty?: number): ShipmentLite {
  return { id, key: id, data: { status, qty: qty ?? null } };
}

describe("fulfillment risks (MFG-0204)", () => {
  const graph = adj([
    ["sh-1", "mfg_dest_customer", "cust-a"],
    ["sh-1", "mfg_dest_plant", "plant-1"],
    ["sh-2", "mfg_dest_customer", "cust-b"],
  ]);

  it("only includes delayed shipments", () => {
    const out = fulfillmentRisks([shipment("sh-1", "delayed", 500), shipment("sh-2", "in_transit", 900)], graph);
    expect(out).toHaveLength(1);
    expect(out[0]!.shipmentId).toBe("sh-1");
  });

  it("traverses downstream customers and plants", () => {
    const out = fulfillmentRisks([shipment("sh-1", "delayed", 500)], graph);
    expect(out[0]!.customers).toEqual(["cust-a"]);
    expect(out[0]!.plants).toEqual(["plant-1"]);
    expect(out[0]!.qty).toBe(500);
  });

  it("sorts by exposure descending", () => {
    const out = fulfillmentRisks([shipment("sh-2", "delayed", 100), shipment("sh-1", "delayed", 500)], graph);
    expect(out.map((r) => r.shipmentId)).toEqual(["sh-1", "sh-2"]);
  });

  it("reports zero qty when unknown", () => {
    const out = fulfillmentRisks([shipment("sh-1", "delayed")], graph);
    expect(out[0]!.qty).toBe(0);
  });
});
