export interface NlIntent {
  view: "lanes" | "lane" | "brief" | "upload" | "help";
  lane?: string;
  weekOffset?: number;
  topic?: "losers" | "winners" | "detention" | "fees" | "fuel";
}

export function parseQuery(raw: string): NlIntent {
  const q = raw.toLowerCase().trim();
  const weekOffset = /last week/.test(q) ? -1 : 0;

  if (/\b(upload|import|connect|add (a )?file|new file)\b/.test(q)) return { view: "upload" };
  if (/\b(brief|monday|report|summary|digest)\b/.test(q)) return { view: "brief", weekOffset };

  const laneMatch = q.match(/\blane\s+(.+?)(?:\s+(last|this)\s+week)?$/);
  if (laneMatch) return { view: "lane", lane: laneMatch[1].trim(), weekOffset };

  if (/\b(lost|losing|worst|bleed|bleeding|unprofitable|negative)\b/.test(q)) {
    return { view: "lanes", topic: "losers", weekOffset };
  }
  if (/\b(best|winning|winners|most profitable|top)\b/.test(q)) {
    return { view: "lanes", topic: "winners", weekOffset };
  }
  if (/\bdetention\b/.test(q)) return { view: "lanes", topic: "detention", weekOffset };
  if (/\b(broker|factor|factoring|fee|fees)\b/.test(q)) return { view: "lanes", topic: "fees", weekOffset };
  if (/\bfuel\b/.test(q)) return { view: "lanes", topic: "fuel", weekOffset };
  if (/\b help\b/.test(q) || q === "help" || /\bhow do i\b/.test(q)) return { view: "help" };

  return { view: "lanes", weekOffset };
}
