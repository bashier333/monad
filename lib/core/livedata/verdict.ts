import { buildEvidence, fuseFlags, type FusedFlag } from "@/lib/core/livedata/fuse";
import type { LiveFlag } from "@/lib/core/livedata/types";

export type Verdict = "FUND" | "REVIEW" | "KILL";

export const KILL_LINE = 40;
export const FUND_LINE = 70;

export interface ScoredCheck {
  verdict: Verdict;
  score: number;
  explanation: string;
  evidence: Array<{ text: string; source: string; url?: string; severity: string }>;
  degradedSources: string[];
}

function scoreFlags(flags: FusedFlag[]): number {
  let score = 88;
  for (const f of flags) {
    if (f.severity === "critical") score -= 30 * f.weight;
    else if (f.severity === "warn") score -= 12 * f.weight;
    else score -= 1;
  }
  return Math.max(2, Math.min(98, Math.round(score)));
}

export function decideVerdict(score: number): Verdict {
  if (score < KILL_LINE) return "KILL";
  if (score < FUND_LINE) return "REVIEW";
  return "FUND";
}

const CAPTIONS: Record<Verdict, string> = {
  FUND: "Clear of the line. Advance.",
  REVIEW: "Above the kill line. Price the doubt.",
  KILL: "Below the kill line. Walk away.",
};

export function verdictCaption(v: Verdict): string {
  return CAPTIONS[v];
}

export function runVerdict(rawFlags: LiveFlag[], degradedSources: string[] = []): ScoredCheck {
  const fused = fuseFlags(rawFlags);
  const score = fused.length === 0 && degradedSources.length === 0 ? 88 : scoreFlags(fused);
  const verdict = fused.length === 0 ? "REVIEW" : decideVerdict(score);
  const parts = [`score ${score} from ${fused.length} fused flag${fused.length === 1 ? "" : "s"}`];
  if (degradedSources.length > 0) parts.push(`${degradedSources.join(", ")} unavailable`);
  return {
    verdict,
    score,
    explanation: parts.join("; ") + ".",
    evidence: buildEvidence(fused),
    degradedSources,
  };
}
