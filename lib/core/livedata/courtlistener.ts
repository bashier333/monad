import { fetchJson } from "@/lib/core/livedata/http";
import { degraded, type ClientOpts, type LiveFlag, type SourceResult } from "@/lib/core/livedata/types";

const BASE = "https://www.courtlistener.com/api/rest/v3";

interface DocketResult {
  caseName?: string;
  dateFiled?: string;
  docketNumber?: string;
}

export async function checkCourtListener(company: string, opts: ClientOpts = {}): Promise<SourceResult> {
  const t0 = Date.now();
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Token ${opts.token}`;
  const params = new URLSearchParams({ q: `"${company}"`, type: "d" });
  const res = await fetchJson(`${BASE}/search/?${params}`, { ...opts, headers });
  if (!res.ok) return { ...degraded("CourtListener", res.error), latencyMs: Date.now() - t0 };
  const body = res.json as { count?: number; results?: DocketResult[] };
  const count = typeof body.count === "number" ? body.count : (body.results ?? []).length;
  const flags: LiveFlag[] = [];
  if (count === 0) return { source: "CourtListener", ok: true, flags, latencyMs: Date.now() - t0 };
  const top = (body.results ?? []).slice(0, 3);
  const severity = count >= 5 ? "critical" : count >= 2 ? "warn" : "info";
  flags.push({
    text: `${count} docket${count === 1 ? "" : "s"} mention ${company}`,
    source: "CourtListener",
    severity,
  });
  for (const d of top) {
    if (d.caseName) {
      flags.push({
        text: d.caseName,
        source: "CourtListener",
        severity: "info",
        at: d.dateFiled,
      });
    }
  }
  return { source: "CourtListener", ok: true, flags, latencyMs: Date.now() - t0 };
}
