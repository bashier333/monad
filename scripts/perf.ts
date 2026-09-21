import { computeLaneMargins, type FeeInput, type FuelInput, type LoadInput } from "../lib/packs/freight/margin/engine";
import { seedAliases } from "../lib/packs/freight/margin/places";
import { reorderSuggestions } from "../lib/packs/manufacturing/logic/reorder";
import { fulfillmentRisks } from "../lib/packs/manufacturing/logic/risk";

const N = 100_000;

function build(): { loads: LoadInput[]; fuels: FuelInput[]; fees: FeeInput[] } {
  const loads: LoadInput[] = [];
  const fuels: FuelInput[] = [];
  const fees: FeeInput[] = [];
  const cities = ["Dallas TX", "Houston TX", "Austin TX", "El Paso TX", "Phoenix AZ", "Oklahoma City OK"];
  for (let i = 0; i < N; i++) {
    const day = String(7 + (i % 7)).padStart(2, "0");
    loads.push({
      loadKey: `L${i}`,
      date: `2026-09-${day}`,
      origin: cities[i % cities.length],
      destination: cities[(i + 1) % cities.length],
      driver: `D${i % 50}`,
      truck: `Unit${i % 40}`,
      broker: "BlueLine",
      revenue: String(1000 + (i % 900)),
      miles: String(150 + (i % 300)),
      detention: i % 10 === 0 ? "75" : "0",
      runId: "perf",
      fileName: "perf.csv",
      rowNumber: i + 2,
    });
    if (i % 3 === 0) {
      fees.push({ loadKey: `L${i}`, fee: "55", runId: "perf", fileName: "broker.csv", rowNumber: i + 2 });
    }
  }
  for (let t = 0; t < 40; t++) {
    fuels.push({ truck: `Unit${t}`, date: "2026-09-08", amount: "400", runId: "perf", fileName: "fuel.csv", rowNumber: t + 2 });
  }
  return { loads, fuels, fees };
}

const { loads, fuels, fees } = build();
const t0 = performance.now();
const r = computeLaneMargins(loads, fuels, fees, seedAliases(), [], "2026-09-07", "2026-09-13");
const ms = performance.now() - t0;
console.log(`loads=${loads.length} lanes=${r.lanes.length} engine_ms=${Math.round(ms)}`);
if (ms > 2000) {
  console.error("PERF BUDGET EXCEEDED: engine > 2000ms");
  process.exit(1);
}

// Manufacturing logic budget (MFG-0200): 10k lots + edges through the
// reorder and risk functions must stay interactive.
{
  const lots = Array.from({ length: 10_000 }, (_, i) => ({
    id: `lot-${i}`,
    key: `lot-${i}`,
    data: { qty_on_hand: 100 + (i % 900), reorder_point: 500, safety_stock: 100, daily_demand: 10 },
  }));
  const edges = lots.flatMap((l, i) => [
    { fromId: l.id, linkKey: "mfg_of_product", toId: `product-${i % 50}` },
    { fromId: `wh-${i % 20}`, linkKey: "mfg_stocks", toId: l.id },
  ]);
  const t1 = performance.now();
  const suggestions = reorderSuggestions(lots, edges);
  const shipments = Array.from({ length: 2000 }, (_, i) => ({
    id: `sh-${i}`,
    key: `sh-${i}`,
    data: { status: i % 10 === 0 ? "delayed" : "in_transit", qty: 100, sla_hours: 24 },
  }));
  const risks = fulfillmentRisks(shipments, new Map());
  const mfgMs = performance.now() - t1;
  console.log(`lots=${lots.length} suggestions=${suggestions.length} risks=${risks.length} mfg_logic_ms=${Math.round(mfgMs)}`);
  if (mfgMs > 2000) {
    console.error("PERF BUDGET EXCEEDED: manufacturing logic > 2000ms");
    process.exit(1);
  }
}
