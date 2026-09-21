import type { TwinOverview } from "@/lib/packs/manufacturing/service";

export interface MfgBrief {
  schemaVersion: 1;
  weekStart: string;
  weekEnd: string;
  counts: Record<string, number>;
  coverage: { avgCoverageDays: number | null; atRiskLots: number; belowReorder: string[] };
  risk: {
    delayedShipments: number;
    exposedQty: number;
    topRisks: Array<{ shipmentKey: string; qty: number; customers: string[]; plants: string[] }>;
  };
  reorder: Array<{ lotKey: string; shortage: number; suggestedFromKey: string | null }>;
  parts: string[];
  variants: Array<{ by: string; key: string; note: string }>;
}

// Weekly coverage/risk brief. Analytics are a byproduct of the twin's
// workflows: every sentence is computed from policy-enforced object reads.
export function buildMfgBrief(overview: TwinOverview, weekStart: string, weekEnd: string): MfgBrief {
  const coverageValues = overview.coverage.map((c) => c.coverageDays).filter((v): v is number => v !== null && Number.isFinite(v));
  const avgCoverage = coverageValues.length === 0 ? null : Math.round((coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length) * 10) / 10;
  const belowReorder = overview.coverage.filter((c) => c.belowReorderPoint).map((c) => c.key);
  const exposedQty = overview.risks.reduce((a, r) => a + r.qty, 0);
  const parts: string[] = [];
  parts.push(
    `Week of ${weekStart}: ${overview.counts.lots} lots across ${overview.counts.plants} plants and ${overview.counts.warehouses} warehouses for ${overview.counts.customers} customers.`
  );
  if (avgCoverage !== null) parts.push(`Average coverage ${avgCoverage} days; ${belowReorder.length} lot${belowReorder.length === 1 ? "" : "s"} at or below reorder point.`);
  if (overview.reorder.length > 0) {
    parts.push(
      `${overview.reorder.length} reorder suggestion${overview.reorder.length === 1 ? "" : "s"}: ` +
        overview.reorder
          .slice(0, 5)
          .map((r) => `${r.lotKey} short ${r.shortage}${r.suggestedFromKey ? `, source ${r.suggestedFromKey}` : ""}`)
          .join("; ") +
        "."
    );
  }
  if (overview.delayedShipments > 0) {
    parts.push(`${overview.delayedShipments} delayed shipment${overview.delayedShipments === 1 ? "" : "s"} exposing ${exposedQty} units.`);
  }
  if (overview.risks.length > 0) {
    const top = overview.risks[0]!;
    parts.push(`Highest exposure ${top.shipmentKey} (${top.qty} units, ${top.customers.length} customer${top.customers.length === 1 ? "" : "s"}, ${top.plants.length} plant${top.plants.length === 1 ? "" : "s"}).`);
  }
  if (parts.length === 1) parts.push("No coverage or risk signals this week.");
  return {
    schemaVersion: 1,
    weekStart,
    weekEnd,
    counts: overview.counts,
    coverage: { avgCoverageDays: avgCoverage, atRiskLots: belowReorder.length, belowReorder },
    risk: {
      delayedShipments: overview.delayedShipments,
      exposedQty,
      topRisks: overview.risks.slice(0, 5).map((r) => ({ shipmentKey: r.shipmentKey, qty: r.qty, customers: r.customers, plants: r.plants })),
    },
    reorder: overview.reorder.slice(0, 10).map((r) => ({ lotKey: r.lotKey, shortage: r.shortage, suggestedFromKey: r.suggestedFromKey })),
    parts,
    variants: [],
  };
}

// Variant explanations: recompute the brief scoped to one region or plant.
export function buildMfgBriefVariants(overview: TwinOverview, base: MfgBrief, nodes: Array<{ id: string; type: string; label: string; region?: string }>): MfgBrief {
  const regions = [...new Set(nodes.map((n) => n.region).filter((r): r is string => Boolean(r)))].slice(0, 5);
  const variants: MfgBrief["variants"] = [];
  for (const region of regions) {
    const inRegion = nodes.filter((n) => n.region === region).map((n) => n.label);
    const delayed = overview.risks.filter(
      (r) =>
        r.plantLabels.some((p) => inRegion.includes(p)) ||
        r.customerLabels.some((c) => inRegion.includes(c))
    );
    const lotsAtRisk = overview.coverage.filter((c) => c.belowReorderPoint && inRegion.some((label) => c.key.startsWith(label.toLowerCase().replace(/[^a-z0-9]+/g, "-"))));
    variants.push({
      by: "region",
      key: region,
      note: `${region}: ${delayed.length} delayed shipment${delayed.length === 1 ? "" : "s"}, ${lotsAtRisk.length} lot${lotsAtRisk.length === 1 ? "" : "s"} below reorder point.`,
    });
  }
  return { ...base, variants };
}
