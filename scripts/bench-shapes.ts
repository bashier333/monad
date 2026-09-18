import { computeLaneMargins, type LoadInput } from "../lib/packs/freight/margin/engine";
import { seedAliases } from "../lib/packs/freight/margin/places";
import { computeProjectMargins, type AgencyInput } from "../lib/packs/agency/engine";
import { seedAgencyAliases } from "../lib/packs/agency/places";

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

const AGENCY_N = 100_000;
const agencyRecords: AgencyInput[] = [];
for (let i = 0; i < AGENCY_N; i++) {
  const day = String(7 + (i % 7)).padStart(2, "0");
  agencyRecords.push({
    recordKey: `AG-${i}`,
    date: `2026-09-${day}`,
    project: `Project${i % 200}`,
    client: `Client${i % 40}`,
    person: `Person${i % 30}`,
    task: "edit",
    hours: String(1 + (i % 8)),
    rate: "100",
    revenue: "",
    runId: "bench",
    fileName: "agency.csv",
    rowNumber: i + 2,
  });
}
const at0 = performance.now();
const ar = computeProjectMargins(agencyRecords, [], [], [], seedAgencyAliases(), [], "2026-09-07", "2026-09-13");
const ams = Math.round(performance.now() - at0);
console.log(`shape=agency-time records=${agencyRecords.length} projects=${ar.projects.length} engine_ms=${ams}`);
if (ams > 2000) {
  console.error("AGENCY BENCH BUDGET EXCEEDED");
  process.exit(1);
}
