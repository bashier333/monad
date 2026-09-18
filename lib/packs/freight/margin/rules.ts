export interface RuleDef {
  id: string;
  sentence: string;
}

import type { FieldKind } from "@/lib/core/corrections/rules";

export const FREIGHT_FIELD_KINDS: Record<string, FieldKind> = {
  date: "date",
  revenue: "number",
  miles: "number",
};

export const RULES: Record<string, RuleDef> = {
  "R-rev-1": {
    id: "R-rev-1",
    sentence: "Load revenue comes from the TMS record's revenue field.",
  },
  "R-det-1": {
    id: "R-det-1",
    sentence: "Detention on a TMS record is charged to that load.",
  },
  "R-fee-1": {
    id: "R-fee-1",
    sentence: "Broker/factor fees are matched to loads by load ID and charged to that load.",
  },
  "R-fuel-1": {
    id: "R-fuel-1",
    sentence:
      "Fuel spend is grouped by truck for the week and split across that truck's loads in proportion to miles (equal split when miles are zero).",
  },
  "R-scope-1": {
    id: "R-scope-1",
    sentence: "Overhead is not allocated in v1 — margins shown are contribution margins.",
  },
};
