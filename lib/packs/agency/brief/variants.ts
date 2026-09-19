import { buildAgencyBrief, type BriefContent } from "@/lib/packs/agency/brief/build";
import {
  computeProjectMargins,
  weekBounds,
  type AgencyResult,
} from "@/lib/packs/agency/engine";
import { getAgencyCorrections, getAgencyInputs, type AgencyAnswer } from "@/lib/packs/agency/service";

export type AgencyVariantBy = "client" | "producer" | "day" | "month";

export function filterRecords<T extends { client: string; person: string; date: string }>(
  records: T[],
  by: AgencyVariantBy,
  key: string,
): T[] {
  if (by === "client") return records.filter((r) => r.client.toLowerCase() === key.toLowerCase());
  if (by === "producer") return records.filter((r) => r.person.toLowerCase() === key.toLowerCase());
  if (by === "day") return records.filter((r) => r.date === key);
  return records;
}

export function mergeAgencyResults(weeks: AgencyResult[]): AgencyResult {
  const revenue = Math.round(weeks.reduce((s, w) => s + w.totals.revenue, 0) * 100) / 100;
  const cost = Math.round(weeks.reduce((s, w) => s + w.totals.cost, 0) * 100) / 100;
  const margin = Math.round((revenue - cost) * 100) / 100;
  const revisions = weeks.reduce((s, w) => s + w.totals.revisions, 0);
  return {
    projects: weeks.flatMap((w) => w.projects),
    totals: { revenue, cost, margin, marginPct: revenue === 0 ? null : Math.round((margin / revenue) * 10000) / 100, revisions },
    appliedRules: weeks.flatMap((w) => w.appliedRules),
    adjustments: weeks.flatMap((w) => w.adjustments),
    unmatchedRevenue: weeks.flatMap((w) => w.unmatchedRevenue),
  };
}

export async function buildAgencyVariant(
  organizationId: string,
  weekStartsOn: number,
  anchorISO: string,
  by: AgencyVariantBy,
  key: string,
  openCorrections: number,
): Promise<BriefContent> {
  const inputs = await getAgencyInputs(organizationId);
  const corrections = await getAgencyCorrections(organizationId);

  if (by === "month") {
    const weeks: AgencyAnswer[] = [];
    const cursor = new Date(`${anchorISO}T00:00:00Z`);
    for (let w = 0; w < 4; w++) {
      const a = cursor.toISOString().slice(0, 10);
      const { start, end } = weekBounds(a, weekStartsOn);
      const r = computeProjectMargins(inputs.records, inputs.assets, inputs.fees, inputs.invoices, inputs.aliases, corrections, start, end, inputs.budgets);
      weeks.push({
        ...r,
        joinConflicts: [],
        meta: { weekStart: start, weekEnd: end, currency: "USD", distanceUnit: "hours", engineVersion: "a1", dataAsOf: inputs.dataAsOf },
      });
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }
    const { start } = weekBounds(anchorISO, weekStartsOn);
    const merged = mergeAgencyResults(weeks);
    const full: AgencyAnswer = {
      ...merged,
      joinConflicts: [],
      meta: { weekStart: start, weekEnd: start, currency: "USD", distanceUnit: "hours", engineVersion: "a1", dataAsOf: inputs.dataAsOf },
    };
    return buildAgencyBrief(full, null, openCorrections);
  }

  const { start, end } = weekBounds(anchorISO, weekStartsOn);
  const filtered = { ...inputs, records: filterRecords(inputs.records, by, key) };
  const r = computeProjectMargins(filtered.records, inputs.assets, inputs.fees, inputs.invoices, inputs.aliases, corrections, start, end, inputs.budgets);
  const full: AgencyAnswer = {
    ...r,
    joinConflicts: [],
    meta: { weekStart: start, weekEnd: end, currency: "USD", distanceUnit: "hours", engineVersion: "a1", dataAsOf: inputs.dataAsOf },
  };
  return buildAgencyBrief(full, null, openCorrections);
}
