import { typoTolerantMatch } from "@/lib/core/search";

export interface IndexedObject {
  id: string;
  typeKey: string;
  key: string;
  text: string;
}

export function indexText(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string" && v.trim() !== "") parts.push(v);
    else if (typeof v === "number" && Number.isFinite(v)) parts.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(data);
  return parts.join(" ").slice(0, 4000);
}

export interface SearchHit {
  id: string;
  typeKey: string;
  key: string;
  score: number;
  // Why this row matched — rendered as the match explanation so results
  // never look like a black box: key (exact key substring), text (a data
  // field contains the term), fuzzy (typo-tolerant fallback).
  matched: "key" | "text" | "fuzzy";
}

export function searchObjects(
  index: IndexedObject[],
  query: string,
  opts: { typeKey?: string; limit?: number } = {}
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const terms = q.split(/\s+/);
  const hits: SearchHit[] = [];
  for (const obj of index) {
    if (opts.typeKey && obj.typeKey !== opts.typeKey) continue;
    if (obj.key.toLowerCase().includes(q)) {
      hits.push({ id: obj.id, typeKey: obj.typeKey, key: obj.key, score: 100, matched: "key" });
      continue;
    }
    const hay = `${obj.key} ${obj.text}`.toLowerCase();
    let score = 0;
    let fuzzy = false;
    for (const term of terms) {
      if (hay.includes(term)) score += 10;
      else if (typoTolerantMatch(hay.slice(0, 400), term)) {
        score += 4;
        fuzzy = true;
      }
    }
    if (score > 0) {
      hits.push({ id: obj.id, typeKey: obj.typeKey, key: obj.key, score, matched: fuzzy ? "fuzzy" : "text" });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface QueryPlan {
  typeKey: string | null;
  measure: string | null;
  direction: "top" | "bottom" | null;
  limit: number;
  timeRange: "this_week" | "last_week" | "this_month" | null;
  unresolved: string[];
}

const DIRECTION_WORDS: Record<string, "top" | "bottom"> = {
  worst: "bottom",
  lowest: "bottom",
  losing: "bottom",
  losers: "bottom",
  best: "top",
  highest: "top",
  top: "top",
  winners: "top",
};

const TIME_WORDS: Record<string, QueryPlan["timeRange"]> = {
  "this week": "this_week",
  "last week": "last_week",
  "this month": "this_month",
};

export function planQuery(
  question: string,
  types: Array<{ key: string; label: string; plural: string; measures: string[]; entityWord: string }>
): QueryPlan {
  const q = question.toLowerCase();
  const plan: QueryPlan = { typeKey: null, measure: null, direction: null, limit: 10, timeRange: null, unresolved: [] };
  for (const t of types) {
    const words = [t.key, t.label.toLowerCase(), t.plural.toLowerCase(), t.entityWord.toLowerCase()];
    if (words.some((w) => w && q.includes(w))) {
      plan.typeKey = t.key;
      for (const m of t.measures) {
        if (q.includes(m.toLowerCase())) {
          plan.measure = m;
          break;
        }
      }
      break;
    }
  }
  for (const [word, dir] of Object.entries(DIRECTION_WORDS)) {
    if (q.includes(word)) {
      plan.direction = dir;
      break;
    }
  }
  const n = /top\s+(\d+)|bottom\s+(\d+)|(\d+)\s+(worst|best)|(worst|best)\s+(\d+)/.exec(q);
  if (n) plan.limit = Math.min(Math.max(Number(n[1] ?? n[2] ?? n[3] ?? n[6]), 1), 100);
  for (const [phrase, range] of Object.entries(TIME_WORDS)) {
    if (q.includes(phrase)) {
      plan.timeRange = range;
      break;
    }
  }
  if (!plan.typeKey) plan.unresolved.push("which object type?");
  if (plan.direction && !plan.measure) plan.unresolved.push("ranked by which measure?");
  return plan;
}

export function explainPlan(plan: QueryPlan): string {
  if (plan.unresolved.length > 0) return `Need clarity: ${plan.unresolved.join(" ")}`;
  const parts = [`type=${plan.typeKey}`];
  if (plan.measure) parts.push(`measure=${plan.measure}`);
  if (plan.direction) parts.push(`order=${plan.direction}`, `limit=${plan.limit}`);
  if (plan.timeRange) parts.push(`when=${plan.timeRange}`);
  return `Understood: ${parts.join(", ")}.`;
}
