import type { LaneMargin, LoadMargin } from "@/lib/packs/freight/margin/engine";
import { laneKey } from "@/lib/packs/freight/margin/places";

function cell(v: string | number | null): string {
  let s = v === null ? "" : String(v);
  if (/^[=+\-@|\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildExportCSV(lanes: LaneMargin[], loads: LoadMargin[], laneFilter: string | null): string {
  const lines: string[] = [];
  lines.push("lane,origin,destination,loads,revenue,cost,margin,margin_pct");
  for (const l of lanes) {
    if (laneFilter && l.lane !== laneFilter) continue;
    lines.push(
      [l.lane, l.origin, l.destination, l.loads, l.revenue, l.cost, l.margin, l.marginPct ?? ""].map(cell).join(","),
    );
  }
  lines.push("");
  lines.push("load,date,origin,destination,driver,truck,revenue,miles,total_cost,margin,cost_kind,cost_label,cost_amount,cost_rule,source_file,source_rows");
  for (const lm of loads) {
    if (laneFilter && laneKey(lm.origin, lm.destination) !== laneFilter) continue;
    if (lm.costs.length === 0) {
      lines.push(
        [lm.loadKey, lm.date, lm.origin, lm.destination, lm.driver, lm.truck, lm.revenue, lm.miles, lm.totalCost, lm.margin, "", "", "", "", "", ""].map(cell).join(","),
      );
    }
    for (const c of lm.costs) {
      lines.push(
        [lm.loadKey, lm.date, lm.origin, lm.destination, lm.driver, lm.truck, lm.revenue, lm.miles, lm.totalCost, lm.margin, c.kind, c.label, c.amount, c.ruleId, c.source.fileName, c.source.rowNumbers.join(";")].map(cell).join(","),
      );
    }
  }
  return lines.join("\n");
}
