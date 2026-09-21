export function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase().replace(/[.,;:'"()]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

export interface MatchScore {
  score: number;
  reasons: string[];
}

export function scoreMatch(a: string, b: string): MatchScore {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  const reasons: string[] = [];
  if (na === nb) return { score: 1, reasons: ["exact"] };
  const distance = levenshtein(na, nb);
  const longest = Math.max(na.length, nb.length, 1);
  const similarity = 1 - distance / longest;
  if (similarity >= 0.85) reasons.push("near-exact");
  const aTokens = new Set(na.split(" "));
  const bTokens = nb.split(" ");
  const shared = bTokens.filter((t) => aTokens.has(t)).length;
  const tokenScore = bTokens.length > 0 ? shared / bTokens.length : 0;
  if (tokenScore >= 0.6) reasons.push("token-overlap");
  const score = Math.max(similarity >= 0.85 ? similarity : 0, tokenScore >= 0.6 ? 0.6 + 0.4 * tokenScore : 0);
  return { score: Math.round(score * 100) / 100, reasons };
}

export interface MergePlan {
  survivorId: string;
  loserId: string;
  fieldPicks: Array<{ field: string; winner: "survivor" | "loser" }>;
  aliasLoserKey: boolean;
}

export function planMerge(
  survivor: { id: string; data: Record<string, unknown> },
  loser: { id: string; data: Record<string, unknown> }
): MergePlan {
  const fieldPicks: MergePlan["fieldPicks"] = [];
  const keys = new Set([...Object.keys(survivor.data), ...Object.keys(loser.data)]);
  for (const field of keys) {
    const s = survivor.data[field];
    const l = loser.data[field];
    if (JSON.stringify(s) === JSON.stringify(l)) continue;
    const survivorEmpty = s === null || s === undefined || s === "";
    fieldPicks.push({ field, winner: survivorEmpty ? "loser" : "survivor" });
  }
  return { survivorId: survivor.id, loserId: loser.id, fieldPicks, aliasLoserKey: true };
}

export function applyMergePlan(
  survivor: Record<string, unknown>,
  loser: Record<string, unknown>,
  plan: MergePlan
): Record<string, unknown> {
  const out = { ...survivor };
  for (const pick of plan.fieldPicks) {
    if (pick.winner === "loser") out[pick.field] = loser[pick.field];
  }
  return out;
}

export function stableObjectKey(typeKey: string, naturalKey: string): string {
  return `${typeKey}:${normalizeKey(naturalKey)}`;
}

// Probabilistic multi-field scoring (Fellegi-Sunter spirit, bounded scope):
// each field scores independently via scoreMatch, then blends by weight.
// Single-field edit distance alone has no term-frequency, no blocking, and
// no ROC analysis — so no single score may auto-merge below threshold, and
// every merge must be reversible (see unmerge below).
export interface FieldScore {
  field: string;
  score: number;
  reasons: string[];
}

export interface WeightedScore {
  score: number;
  reasons: string[];
  perField: FieldScore[];
}

export function scoreFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  weights: Record<string, number>
): WeightedScore {
  const perField: FieldScore[] = [];
  let total = 0;
  let weightSum = 0;
  for (const [field, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    const sa = a[field];
    const sb = b[field];
    if (sa === null || sa === undefined || sa === "" || sb === null || sb === undefined || sb === "") continue;
    const m = scoreMatch(String(sa), String(sb));
    perField.push({ field, score: m.score, reasons: m.reasons });
    total += m.score * weight;
    weightSum += weight;
  }
  const score = weightSum > 0 ? Math.round((total / weightSum) * 100) / 100 : 0;
  const reasons = perField.flatMap((f) => f.reasons.map((r) => `${f.field}:${r}`));
  return { score, reasons, perField };
}

export const AUTO_MERGE_THRESHOLD = 0.92;
export const REVIEW_THRESHOLD = 0.7;

export type MatchClass = "auto" | "review" | "no-match";

export function classifyMatch(score: number): MatchClass {
  if (score >= AUTO_MERGE_THRESHOLD) return "auto";
  if (score >= REVIEW_THRESHOLD) return "review";
  return "no-match";
}

export interface MergeReview {
  actionKey: "identity.merge.review";
  survivorId: string;
  loserId: string;
  score: number;
  matchClass: MatchClass;
  reasons: string[];
  perField: FieldScore[];
  plan: MergePlan;
  // Snapshots of BOTH sides pre-merge. Unmerge is impossible without them,
  // so persistence layers must store this payload (e.g. as an OntoApproval
  // with actionKey "identity.merge.review") before applying any merge.
  survivorSnapshot: Record<string, unknown>;
  loserSnapshot: Record<string, unknown>;
}

// Build the review record for a candidate pair. Scores below REVIEW_THRESHOLD
// return null (no record, no queue noise). Scores at/above AUTO still go
// through the review record — auto-class only skips the human, never the
// audit trail or the snapshots.
export function proposeMerge(
  survivor: { id: string; data: Record<string, unknown> },
  loser: { id: string; data: Record<string, unknown> },
  weights: Record<string, number>
): MergeReview | null {
  const scored = scoreFields(survivor.data, loser.data, weights);
  const matchClass = classifyMatch(scored.score);
  if (matchClass === "no-match") return null;
  return {
    actionKey: "identity.merge.review",
    survivorId: survivor.id,
    loserId: loser.id,
    score: scored.score,
    matchClass,
    reasons: scored.reasons,
    perField: scored.perField,
    plan: planMerge(survivor, loser),
    survivorSnapshot: { ...survivor.data },
    loserSnapshot: { ...loser.data },
  };
}

// Unmerge restores both sides from the review snapshots. Deterministic
// downstream amplifies probabilistic error, so every merge path must offer
// this exit: pass the stored review back and both objects return to
// pre-merge state (callers then re-link / clear aliases + audit the event).
export function applyUnmerge(review: MergeReview): {
  survivor: Record<string, unknown>;
  loser: Record<string, unknown>;
} {
  return { survivor: { ...review.survivorSnapshot }, loser: { ...review.loserSnapshot } };
}
