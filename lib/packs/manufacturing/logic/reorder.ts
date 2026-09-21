import type { AdjEdge } from "@/lib/core/ontology/graph";

export interface LotLite {
  id: string;
  key: string;
  data: { qty_on_hand: number; reorder_point?: number | null; safety_stock?: number | null; daily_demand?: number | null };
}

export interface WarehouseLite {
  id: string;
  key: string;
  data: { name?: string; region?: string };
}

export interface ReorderSuggestion {
  lotId: string;
  lotKey: string;
  shortage: number;
  suggestedFromId: string | null;
  suggestedFromKey: string | null;
  available: number;
}

const OF_PRODUCT = "mfg_of_product";
const STOCKS = "mfg_stocks";

// Lots at or below their reorder point get a transfer suggestion from the
// warehouse holding the most surplus of the same product, found by walking
// the graph in both directions:
//   lot -of_product-> product <-of_product- sibling lot <-stocks- warehouse
export function reorderSuggestions(lots: LotLite[], edges: AdjEdge[]): ReorderSuggestion[] {
  const out = new Map<string, AdjEdge[]>();
  const incoming = new Map<string, AdjEdge[]>();
  for (const e of edges) {
    const o = out.get(e.fromId) ?? [];
    o.push(e);
    out.set(e.fromId, o);
    const inc = incoming.get(e.toId) ?? [];
    inc.push(e);
    incoming.set(e.toId, inc);
  }
  const outList = (id: string): AdjEdge[] => out.get(id) ?? [];
  const inList = (id: string): AdjEdge[] => incoming.get(id) ?? [];
  const byId = new Map(lots.map((l) => [l.id, l]));
  const result: ReorderSuggestion[] = [];
  for (const lot of lots) {
    const reorder = lot.data.reorder_point ?? null;
    if (reorder === null || lot.data.qty_on_hand >= reorder) continue;
    const shortage = reorder - lot.data.qty_on_hand;
    const productId = outList(lot.id).find((e) => e.linkKey === OF_PRODUCT && e.toId)?.toId;
    let best: { warehouseId: string | null; available: number } = { warehouseId: null, available: 0 };
    if (productId) {
      const siblingIds = inList(productId)
        .filter((e) => e.linkKey === OF_PRODUCT && e.fromId !== lot.id)
        .map((e) => e.fromId);
      for (const sibId of siblingIds) {
        const sib = byId.get(sibId);
        if (!sib) continue;
        const floor = sib.data.reorder_point ?? sib.data.safety_stock ?? 0;
        const surplus = sib.data.qty_on_hand - floor;
        if (surplus <= best.available) continue;
        const whEdge = inList(sibId).find((e) => e.linkKey === STOCKS && e.fromId);
        best = { warehouseId: whEdge ? whEdge.fromId : null, available: surplus };
      }
    }
    result.push({
      lotId: lot.id,
      lotKey: lot.key,
      shortage,
      suggestedFromId: best.warehouseId,
      suggestedFromKey: best.warehouseId,
      available: best.available,
    });
  }
  return result.sort((a, b) => b.shortage - a.shortage);
}
