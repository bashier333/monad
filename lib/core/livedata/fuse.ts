import type { LiveFlag, Severity } from "@/lib/core/livedata/types";

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warn: 1, critical: 2 };

export interface FusedFlag extends LiveFlag {
  confidence: number;
  weight: number;
}

const SOURCE_WEIGHTS: Record<string, number> = {
  OpenCorporates: 1.0,
  CourtListener: 0.9,
  EDGAR: 0.9,
  GDELT: 0.5,
};

function flagKey(f: LiveFlag): string {
  return `${f.source}::${f.text.trim().toLowerCase().slice(0, 160)}`;
}

export function dedupeFlags(flags: LiveFlag[]): LiveFlag[] {
  const seen = new Set<string>();
  const out: LiveFlag[] = [];
  for (const f of flags) {
    const key = flagKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function fuseFlags(flags: LiveFlag[]): FusedFlag[] {
  const deduped = dedupeFlags(flags);
  return deduped
    .map((f) => {
      const weight = SOURCE_WEIGHTS[f.source] ?? 0.4;
      const recencyBoost = f.at ? 0.1 : 0;
      const confidence = Math.min(1, Math.round((weight * 0.8 + recencyBoost + 0.1) * 100) / 100);
      return { ...f, confidence, weight };
    })
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.confidence - a.confidence);
}

export interface Evidence {
  text: string;
  source: string;
  url?: string;
  severity: Severity;
}

export function buildEvidence(flags: FusedFlag[]): Evidence[] {
  return flags.map((f) => ({ text: f.text, source: f.source, url: f.url, severity: f.severity }));
}
