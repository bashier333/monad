import { RULES_AG } from "@/lib/packs/agency/rules";
import type { FieldKind } from "@/lib/core/corrections/rules";

export interface AgencyOntology {
  id: "agency";
  version: 1;
  entities: string[];
  groupKey: { name: string; fields: [string] };
  measures: Array<{ name: string; unit: string }>;
  costKinds: string[];
  sources: Array<{ type: string; required: string[] }>;
  ruleIds: string[];
  fieldKinds: Record<string, FieldKind>;
  nlEntityWord: string;
  nlTopics: string[];
  presets: string[];
  vocabulary: Record<string, string>;
}

export const AGENCY_ONTOLOGY: AgencyOntology = {
  id: "agency",
  version: 1,
  entities: ["project", "revision", "asset", "approval", "client"],
  groupKey: { name: "project", fields: ["project"] },
  measures: [
    { name: "revenue", unit: "USD" },
    { name: "cost", unit: "USD" },
    { name: "margin", unit: "USD" },
    { name: "marginPct", unit: "%" },
    { name: "revisions", unit: "rounds" },
    { name: "turnaroundHours", unit: "hours" },
  ],
  costKinds: ["labor", "rush", "asset"],
  sources: [
    { type: "time", required: ["project", "date", "hours"] },
    { type: "revision", required: ["project", "date"] },
    { type: "approval", required: ["project", "sentDate"] },
    { type: "invoice", required: ["project", "amount"] },
    { type: "asset", required: ["asset"] },
    { type: "rate", required: ["rate"] },
    { type: "project", required: ["project"] },
    { type: "feedback", required: ["round"] },
  ],
  ruleIds: ["R-ag-1", "R-ag-2", "R-ag-3", "R-ag-4"],
  fieldKinds: { date: "date", hours: "number", amount: "number", revenue: "number" },
  nlEntityWord: "project",
  nlTopics: ["losers", "winners", "rework", "approvals", "bottlenecks"],
  presets: ["harvest", "asana", "frameio", "quickbooks", "generic"],
  vocabulary: {
    group: "project",
    groups: "projects",
    record: "revision",
    records: "revisions",
    period: "week",
    money: "margin",
  },
};

export function validateAgencyOntology(o: AgencyOntology): string[] {
  const problems: string[] = [];
  for (const id of o.ruleIds) {
    if (!RULES_AG[id]) problems.push(`rule ${id} missing from RULES_AG`);
  }
  if (!o.entities.includes("project")) problems.push("entities must include project");
  if (o.measures.length === 0) problems.push("at least one measure required");
  return problems;
}
