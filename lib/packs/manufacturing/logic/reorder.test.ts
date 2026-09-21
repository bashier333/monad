import { describe, expect, it } from "vitest";
import { reorderSuggestions, type LotLite } from "@/lib/packs/manufacturing/logic/reorder";
import type { AdjEdge } from "@/lib/core/ontology/graph";

function lot(id: string, qty: number, reorder?: number): LotLite {
  return { id, key: id, data: { qty_on_hand: qty, reorder_point: reorder ?? null } };
}

function edge(fromId: string, linkKey: string, toId: string): AdjEdge {
  return { fromId, linkKey, toId };
}

describe("reorder suggestions (MFG-0203)", () => {
  it("suggests the warehouse with the most surplus", () => {
    const lots: LotLite[] = [lot("lot-a", 40, 100), lot("lot-b", 200, 50)];
    const edges: AdjEdge[] = [
      edge("lot-a", "mfg_of_product", "product-1"),
      edge("lot-b", "mfg_of_product", "product-1"),
      edge("wh-1", "mfg_stocks", "lot-b"),
    ];
    const out = reorderSuggestions(lots, edges);
    expect(out).toHaveLength(1);
    expect(out[0]!.lotId).toBe("lot-a");
    expect(out[0]!.shortage).toBe(60);
    expect(out[0]!.suggestedFromId).toBe("wh-1");
    expect(out[0]!.available).toBe(150);
  });

  it("skips lots at or above the reorder point", () => {
    const out = reorderSuggestions([lot("lot-b", 200, 50), lot("lot-x", 10)], [
      edge("lot-b", "mfg_of_product", "product-1"),
    ]);
    expect(out).toHaveLength(0);
  });

  it("returns no suggestion when the sibling lot is unknown", () => {
    const out = reorderSuggestions([lot("lot-a", 10, 50)], [edge("lot-a", "mfg_of_product", "product-1")]);
    expect(out).toHaveLength(1);
    expect(out[0]!.suggestedFromId).toBeNull();
    expect(out[0]!.available).toBe(0);
  });

  it("sorts by shortage descending", () => {
    const lots: LotLite[] = [lot("lot-a", 90, 100), lot("lot-b", 10, 100)];
    const edges: AdjEdge[] = [
      edge("lot-a", "mfg_of_product", "product-1"),
      edge("lot-b", "mfg_of_product", "product-1"),
    ];
    const out = reorderSuggestions(lots, edges);
    expect(out.map((s) => s.lotId)).toEqual(["lot-b", "lot-a"]);
  });

  it("uses sibling surplus above its own reorder floor", () => {
    const lots: LotLite[] = [lot("lot-a", 10, 100), lot("lot-b", 60, 50)];
    const edges: AdjEdge[] = [
      edge("lot-a", "mfg_of_product", "product-1"),
      edge("lot-b", "mfg_of_product", "product-1"),
      edge("wh-9", "mfg_stocks", "lot-b"),
    ];
    const out = reorderSuggestions(lots, edges);
    expect(out[0]!.available).toBe(10);
    expect(out[0]!.suggestedFromId).toBe("wh-9");
  });
});
