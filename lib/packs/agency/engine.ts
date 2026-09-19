import {
  applyCorrectionsToRecords,
  type CostLine,
} from "@/lib/core/corrections/apply";
import type { AppliedCorrection } from "@/lib/core/corrections/rules";
import { toISODate, weekBounds } from "@/lib/core/dates";
import { normalizeName } from "@/lib/core/names";
import { RULES_AG } from "@/lib/packs/agency/rules";
import type { AgencyRuleDef } from "@/lib/packs/agency/rules";

export const AGENCY_ENGINE_VERSION = "a1";
export const AGENCY_CURRENCY = "USD";

export interface AgencyInput {
  recordKey: string;
  date: string;
  project: string;
  client: string;
  person: string;
  task: string;
  hours: string;
  rate: string;
  revenue: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface AgencyAsset {
  project: string;
  date: string;
  amount: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface AgencyFee {
  project: string;
  fee: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface AgencyInvoice {
  project: string;
  amount: string;
  runId: string;
  fileName: string;
  rowNumber: number;
}

export interface AgencyBudget {
  project: string;
  amount: string;
}

export interface ProjectMargin {
  project: string;
  client: string;
  revisions: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number | null;
  budget: number | null;
  budgetVsActual: number | null;
  costByKind: Record<string, number>;
  recordKeys: string[];
  appliedRules: AgencyRuleDef[];
  loads: AgencyLoadMargin[];
}

export interface AgencyLoadMargin {
  loadKey: string;
  date: string;
  project: string;
  client: string;
  person: string;
  task: string;
  hours: number;
  revenue: number;
  costs: CostLine[];
  totalCost: number;
  margin: number;
  marginPct: number | null;
}

export interface AgencyResult {
  projects: ProjectMargin[];
  totals: { revenue: number; cost: number; margin: number; marginPct: number | null; revisions: number };
  appliedRules: AgencyRuleDef[];
  adjustments: Array<{ correctionId: string; description: string }>;
  unmatchedRevenue: Array<{ project: string; amount: number }>;
}

export function parseMoney(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function pct(margin: number, revenue: number): number | null {
  if (revenue === 0) return null;
  return Math.round((margin / revenue) * 10000) / 100;
}

export function computeProjectMargins(
  records: AgencyInput[],
  assets: AgencyAsset[],
  fees: AgencyFee[],
  invoices: AgencyInvoice[],
  aliases: Map<string, string>,
  corrections: AppliedCorrection[],
  weekStart: string,
  weekEnd: string,
  budgets: AgencyBudget[] = [],
): AgencyResult {
  const inWeek = records.filter((r) => {
    const d = toISODate(r.date);
    return d !== null && d >= weekStart && d <= weekEnd;
  });

  const byKey = new Map<string, AgencyLoadMargin>();
  for (const r of inWeek) {
    const project = normalizeName(r.project, aliases);
    const hours = parseMoney(r.hours);
    const rate = parseMoney(r.rate);
    const labor = Math.round(hours * rate * 100) / 100;
    const costs: CostLine[] = [];
    if (labor !== 0) {
      costs.push({
        kind: "labor",
        label: `Labor (${r.person || "unassigned"})`,
        amount: labor,
        ruleId: "R-ag-1",
        source: { runId: r.runId, fileName: r.fileName, rowNumbers: [r.rowNumber] },
      });
    }
    byKey.set(r.recordKey, {
      loadKey: r.recordKey,
      date: toISODate(r.date) ?? r.date,
      project,
      client: normalizeName(r.client, aliases),
      person: r.person,
      task: r.task,
      hours,
      revenue: 0,
      costs,
      totalCost: 0,
      margin: 0,
      marginPct: null,
    });
  }

  for (const f of fees) {
    const project = normalizeName(f.project, aliases);
    const amount = parseMoney(f.fee);
    if (amount === 0) continue;
    for (const lm of byKey.values()) {
      if (lm.project !== project) continue;
      lm.costs.push({
        kind: "rush",
        label: "Rush fee",
        amount,
        ruleId: "R-ag-2",
        source: { runId: f.runId, fileName: f.fileName, rowNumbers: [f.rowNumber] },
      });
      break;
    }
  }

  const assetByProject = new Map<string, { amount: number; source: CostLine["source"] }>();
  for (const a of assets) {
    const d = toISODate(a.date);
    if (d === null || d < weekStart || d > weekEnd) continue;
    const project = normalizeName(a.project, aliases);
    if (!project) continue;
    const amount = parseMoney(a.amount);
    if (amount === 0) continue;
    const cur = assetByProject.get(project) ?? { amount: 0, source: { runId: a.runId, fileName: a.fileName, rowNumbers: [] as number[] } };
    cur.amount = Math.round((cur.amount + amount) * 100) / 100;
    cur.source.rowNumbers.push(a.rowNumber);
    assetByProject.set(project, cur);
  }

  const byProject = new Map<string, AgencyLoadMargin[]>();
  for (const lm of byKey.values()) {
    const list = byProject.get(lm.project) ?? [];
    list.push(lm);
    byProject.set(lm.project, list);
  }
  for (const [project, bucket] of assetByProject) {
    const members = byProject.get(project) ?? [];
    if (members.length === 0) continue;
    const totalHours = members.reduce((s, l) => s + l.hours, 0);
    for (const lm of members) {
      const share = totalHours > 0 ? bucket.amount * (lm.hours / totalHours) : bucket.amount / members.length;
      const amount = Math.round(share * 100) / 100;
      if (amount === 0) continue;
      lm.costs.push({
        kind: "asset",
        label: `Shared assets (${project})`,
        amount,
        ruleId: "R-ag-3",
        source: bucket.source,
      });
    }
  }

  const adjustments = applyCorrectionsToRecords(byKey, corrections);

  const revenueByProject = new Map<string, number>();
  for (const inv of invoices) {
    const project = normalizeName(inv.project, aliases);
    if (!project) continue;
    const amount = parseMoney(inv.amount);
    if (amount === 0) continue;
    revenueByProject.set(project, Math.round(((revenueByProject.get(project) ?? 0) + amount) * 100) / 100);
  }

  const unmatchedRevenue: AgencyResult["unmatchedRevenue"] = [];
  for (const [project, amount] of revenueByProject) {
    if (!byProject.has(project)) unmatchedRevenue.push({ project, amount });
  }

  const budgetByProject = new Map<string, number>();
  for (const b of budgets) {
    const project = normalizeName(b.project, aliases);
    if (!project) continue;
    const amount = parseMoney(b.amount);
    if (amount !== 0) budgetByProject.set(project, amount);
  }

  const projectMap = new Map<string, ProjectMargin>();
  const ruleIds = new Set<string>(["R-ag-4"]);
  for (const lm of byKey.values()) {
    lm.totalCost = Math.round(lm.costs.reduce((s, c) => s + c.amount, 0) * 100) / 100;
    lm.margin = Math.round((0 - lm.totalCost) * 100) / 100;
    lm.marginPct = null;
    for (const c of lm.costs) ruleIds.add(c.ruleId.startsWith("corr:") ? "corr" : c.ruleId);
    let p = projectMap.get(lm.project);
    if (!p) {
      p = {
        project: lm.project,
        client: lm.client,
        revisions: 0,
        revenue: 0,
        cost: 0,
        margin: 0,
        marginPct: null,
        budget: null,
        budgetVsActual: null,
        costByKind: {},
        recordKeys: [],
        appliedRules: [],
        loads: [],
      };
      projectMap.set(lm.project, p);
    }
    p.revisions++;
    p.revenue = revenueByProject.get(lm.project) ?? 0;
    p.cost = Math.round((p.cost + lm.totalCost) * 100) / 100;
    p.recordKeys.push(lm.loadKey);
    p.loads.push(lm);
    for (const c of lm.costs) {
      p.costByKind[c.kind] = Math.round(((p.costByKind[c.kind] ?? 0) + c.amount) * 100) / 100;
    }
  }

  const projects = [...projectMap.values()].map((p) => {
    const margin = Math.round((p.revenue - p.cost) * 100) / 100;
    const budget = budgetByProject.get(p.project) ?? null;
    return {
      ...p,
      margin,
      marginPct: pct(margin, p.revenue),
      budget,
      budgetVsActual: budget === null ? null : Math.round((p.cost - budget) * 100) / 100,
    };
  });
  projects.sort((a, b) => a.margin - b.margin);

  const totals = {
    revenue: Math.round(projects.reduce((s, l) => s + l.revenue, 0) * 100) / 100,
    cost: Math.round(projects.reduce((s, l) => s + l.cost, 0) * 100) / 100,
    margin: 0,
    marginPct: null as number | null,
    revisions: projects.reduce((s, l) => s + l.revisions, 0),
  };
  totals.margin = Math.round((totals.revenue - totals.cost) * 100) / 100;
  totals.marginPct = pct(totals.margin, totals.revenue);

  const appliedRules: AgencyRuleDef[] = [...ruleIds]
    .filter((id) => id !== "corr")
    .map((id) => RULES_AG[id])
    .filter((r): r is AgencyRuleDef => Boolean(r));
  if (ruleIds.has("corr")) {
    appliedRules.push({ id: "corr", sentence: "Human corrections applied (see adjustments)." });
  }

  return { projects, totals, appliedRules, adjustments, unmatchedRevenue };
}

export { weekBounds };
