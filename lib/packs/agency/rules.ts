import type { FieldKind } from "@/lib/core/corrections/rules";

export interface AgencyRuleDef {
  id: string;
  sentence: string;
}

export const RULES_AG: Record<string, AgencyRuleDef> = {
  "R-ag-1": {
    id: "R-ag-1",
    sentence: "Revision labor (hours × rate) is charged to its project.",
  },
  "R-ag-2": {
    id: "R-ag-2",
    sentence: "Rush fees are matched to projects by project name and charged to that project.",
  },
  "R-ag-3": {
    id: "R-ag-3",
    sentence:
      "Shared asset costs are grouped by project for the week and split across that project's revisions in proportion to hours (equal split when hours are zero).",
  },
  "R-ag-4": {
    id: "R-ag-4",
    sentence: "Overhead is not allocated in v1 — margins shown are contribution margins.",
  },
};

export const AGENCY_FIELD_KINDS: Record<string, FieldKind> = {
  date: "date",
  hours: "number",
  amount: "number",
  revenue: "number",
};
