import { fetchJson } from "@/lib/core/livedata/http";
import { degraded, type ClientOpts, type LiveFlag, type SourceResult } from "@/lib/core/livedata/types";

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

interface GdeltArticle {
  title?: string;
  url?: string;
  seendate?: string;
  tone?: string;
  language?: string;
}

export async function checkGdelt(company: string, opts: ClientOpts = {}): Promise<SourceResult> {
  const t0 = Date.now();
  const params = new URLSearchParams({
    query: `"${company}"`,
    mode: "artlist",
    maxrecords: "20",
    format: "json",
    timespan: "90d",
  });
  const res = await fetchJson(`${BASE}?${params}`, { ...opts });
  if (!res.ok) return { ...degraded("GDELT", res.error), latencyMs: Date.now() - t0 };
  const body = res.json as { articles?: GdeltArticle[] };
  const articles = (body.articles ?? []).filter((a) => (a.language ?? "English") === "English");
  const flags: LiveFlag[] = [];
  if (articles.length === 0) return { source: "GDELT", ok: true, flags, latencyMs: Date.now() - t0 };
  const tones = articles.map((a) => Number(a.tone)).filter((n) => Number.isFinite(n));
  const avg = tones.length > 0 ? tones.reduce((x, y) => x + y, 0) / tones.length : 0;
  if (avg <= -3) {
    flags.push({ text: `Sharply negative press tone (${avg.toFixed(1)}) across ${articles.length} stories`, source: "GDELT", severity: "warn" });
  } else if (articles.length >= 8) {
    flags.push({ text: `${articles.length} press mentions in 90 days`, source: "GDELT", severity: "info" });
  }
  for (const a of articles.slice(0, 3)) {
    if (a.title) flags.push({ text: a.title.slice(0, 140), source: "GDELT", url: a.url, severity: "info", at: a.seendate });
  }
  return { source: "GDELT", ok: true, flags, latencyMs: Date.now() - t0 };
}
