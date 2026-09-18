import { RULES } from "@/lib/packs/freight/margin/rules";
import type { FieldKind } from "@/lib/core/corrections/rules";

export interface FreightOntology {
  id: "freight";
  version: 1;
  entities: string[];
  groupKey: { name: string; fields: [string, string] };
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

export const FREIGHT_ONTOLOGY: FreightOntology = {
  id: "freight",
  version: 1,
  entities: ["load", "lane", "truck", "driver", "broker"],
  groupKey: { name: "lane", fields: ["origin", "destination"] },
  measures: [
    { name: "revenue", unit: "USD" },
    { name: "cost", unit: "USD" },
    { name: "margin", unit: "USD" },
    { name: "marginPct", unit: "%" },
    { name: "miles", unit: "miles" },
  ],
  costKinds: ["detention", "fee", "fuel", "adjustment"],
  sources: [
    { type: "tms", required: ["loadId", "date", "revenue"] },
    { type: "fuel", required: ["truck", "date", "amount"] },
    { type: "broker", required: ["loadId"] },
  ],
  ruleIds: ["R-rev-1", "R-det-1", "R-fee-1", "R-fuel-1", "R-scope-1"],
  fieldKinds: { date: "date", revenue: "number", miles: "number" },
  nlEntityWord: "lane",
  nlTopics: ["losers", "winners", "detention", "fees", "fuel"],
  presets: ["generic", "mcleod", "tmw", "prophesy", "ascend"],
  vocabulary: {
    group: "lane",
    groups: "lanes",
    record: "load",
    records: "loads",
    period: "week",
    money: "margin",
  },
};

export function validateOntology(o: FreightOntology): string[] {
  const problems: string[] = [];
  for (const id of o.ruleIds) {
    if (!RULES[id]) problems.push(`rule ${id} missing from RULES`);
  }
  if (!o.entities.includes("load")) problems.push("entities must include load");
  if (o.measures.length === 0) problems.push("at least one measure required");
  return problems;
}
