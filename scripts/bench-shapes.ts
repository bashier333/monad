import { computeLaneMargins, type LoadInput } from "../lib/margin/engine";
import { seedAliases } from "../lib/margin/places";

const SHAPES = ["mcleod", "tmw", "prophesy", "ascend", "generic"] as const;
const N = 50_000;

function build(shape: string): LoadInput[] {
  const loads: LoadInput[] = [];
  for (let i = 0; i < N; i++) {
    const day = String(7 + (i % 7)).padStart(2, "0");
    loads.push({
      loadKey: `${shape}-${i}`,
      date: `2026-09-${day}`,
      origin: shape === "tmw" ? "DAL" : "Dallas TX",
      destination: "Houston TX",
      driver: `D${i % 50}`,
      truck: `Unit${i % 40}`,
      broker: "BlueLine",
      revenue: String(1000 + (i % 900)),
      miles: String(150 + (i % 300)),
      detention: i % 10 === 0 ? "75" : "0",
      runId: "bench",
      fileName: `${shape}.csv`,
      rowNumber: i + 2,
    });
  }
  return loads;
}

let worst = 0;
for (const shape of SHAPES) {
  const loads = build(shape);
  const t0 = performance.now();
  const r = computeLaneMargins(loads, [], [], seedAliases(), [], "2026-09-07", "2026-09-13");
  const ms = Math.round(performance.now() - t0);
  worst = Math.max(worst, ms);
  console.log(`shape=${shape} loads=${loads.length} lanes=${r.lanes.length} engine_ms=${ms}`);
}
if (worst > 2000) {
  console.error("BENCH BUDGET EXCEEDED");
  process.exit(1);
}
