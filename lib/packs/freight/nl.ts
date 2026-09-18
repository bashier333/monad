import { parseQueryGeneric, type NlIntent, type NlPackConfig } from "@/lib/core/answers/nl";

export type { NlIntent };

export const FREIGHT_NL: NlPackConfig = {
  entityWord: "lane",
  topics: [
    { topic: "losers", patterns: ["lost", "losing", "worst", "bleed", "bleeding", "unprofitable", "negative"] },
    { topic: "winners", patterns: ["best", "winning", "winners", "most profitable", "top"] },
    { topic: "detention", patterns: ["detention"] },
    { topic: "fees", patterns: ["broker", "factor", "factoring", "fee", "fees"] },
    { topic: "fuel", patterns: ["fuel"] },
  ],
};

export function parseQuery(raw: string): NlIntent {
  return parseQueryGeneric(raw, FREIGHT_NL);
}
