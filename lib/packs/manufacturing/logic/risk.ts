export interface ShipmentLite {
  id: string;
  key: string;
  data: { status: string; qty?: number | null; sla_hours?: number | null };
}

export interface FulfillmentRisk {
  shipmentId: string;
  shipmentKey: string;
  qty: number;
  customers: string[];
  plants: string[];
}

const DEST_CUSTOMER = "mfg_dest_customer";
const DEST_PLANT = "mfg_dest_plant";

// Delayed shipments become fulfillment risks with the traversed downstream
// exposure: the customers and plants waiting on each one.
export function fulfillmentRisks(
  shipments: ShipmentLite[],
  adjacency: Map<string, Array<{ fromId: string; linkKey: string; toId: string }>>
): FulfillmentRisk[] {
  const out: FulfillmentRisk[] = [];
  for (const s of shipments) {
    if (s.data.status !== "delayed") continue;
    const edges = adjacency.get(s.id) ?? [];
    const customers = edges.filter((e) => e.linkKey === DEST_CUSTOMER && e.toId).map((e) => e.toId);
    const plants = edges.filter((e) => e.linkKey === DEST_PLANT && e.toId).map((e) => e.toId);
    out.push({
      shipmentId: s.id,
      shipmentKey: s.key,
      qty: s.data.qty ?? 0,
      customers,
      plants,
    });
  }
  return out.sort((a, b) => b.qty - a.qty);
}
