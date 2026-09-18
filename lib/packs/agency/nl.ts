import { parseQueryGeneric, type NlIntent, type NlPackConfig } from "@/lib/core/answers/nl";

export type { NlIntent };

export const AGENCY_NL: NlPackConfig = {
  entityWord: "project",
  topics: [
    { topic: "losers", patterns: ["lost", "losing", "worst", "bleed", "bleeding", "unprofitable", "negative"] },
    { topic: "winners", patterns: ["best", "winning", "winners", "most profitable", "top"] },
    { topic: "rework", patterns: ["rework", "revision", "revisions", "rounds", "redo"] },
    { topic: "approvals", patterns: ["approval", "approvals", "signoff", "sign-off", "signed"] },
    { topic: "bottlenecks", patterns: ["bottleneck", "bottlenecks", "stuck", "waiting", "delay", "delays", "late"] },
  ],
};

export function parseAgencyQuery(raw: string): NlIntent {
  return parseQueryGeneric(raw, AGENCY_NL);
}
