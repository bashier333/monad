import { checkCourtListener } from "@/lib/core/livedata/courtlistener";
import { checkEdgar } from "@/lib/core/livedata/edgar";
import { checkGdelt } from "@/lib/core/livedata/gdelt";
import { checkOpenCorporates } from "@/lib/core/livedata/opencorporates";
import { runVerdict, type ScoredCheck } from "@/lib/core/livedata/verdict";
import type { ClientOpts, SourceResult } from "@/lib/core/livedata/types";

export interface CheckOptions extends ClientOpts {
  sources?: Array<"opencorporates" | "courtlistener" | "edgar" | "gdelt">;
  budgetMs?: number;
}

export interface CheckReport extends ScoredCheck {
  company: string;
  elapsedMs: number;
  sourceStates: Array<{ source: string; ok: boolean; flags: number; error?: string }>;
}

const RUNNERS = {
  opencorporates: checkOpenCorporates,
  courtlistener: checkCourtListener,
  edgar: checkEdgar,
  gdelt: checkGdelt,
} as const;

export async function runCheck(company: string, opts: CheckOptions = {}): Promise<CheckReport> {
  const t0 = Date.now();
  const names = opts.sources ?? (Object.keys(RUNNERS) as Array<keyof typeof RUNNERS>);
  const budgetMs = opts.budgetMs ?? 40000;
  const deadline = t0 + budgetMs;
  const settled = await Promise.all(
    names.map(async (name): Promise<SourceResult> => {
      const remaining = Math.max(1000, deadline - Date.now());
      try {
        return await RUNNERS[name](company, { ...opts, timeoutMs: Math.min(opts.timeoutMs ?? 8000, remaining) });
      } catch (err) {
        return {
          source: name,
          ok: false,
          flags: [],
          error: err instanceof Error ? err.message : "failed",
          latencyMs: Date.now() - t0,
          degraded: true,
        };
      }
    })
  );
  const flags = settled.filter((s) => s.ok).flatMap((s) => s.flags);
  const degradedSources = settled.filter((s) => !s.ok).map((s) => s.source);
  const verdict = runVerdict(flags, degradedSources);
  return {
    ...verdict,
    company: company.trim().slice(0, 160),
    elapsedMs: Date.now() - t0,
    sourceStates: settled.map((s) => ({ source: s.source, ok: s.ok, flags: s.flags.length, error: s.error })),
  };
}
