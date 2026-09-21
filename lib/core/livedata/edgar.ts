import { fetchJson } from "@/lib/core/livedata/http";
import { degraded, type ClientOpts, type LiveFlag, type SourceResult } from "@/lib/core/livedata/types";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const SUB_URL = (cik: string) => `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`;
const CONTACT = process.env.SEC_CONTACT ?? "LenderEye research";

function secHeaders(): Record<string, string> {
  return { "User-Agent": `LenderEye/1.0 (${CONTACT})`, "Accept-Encoding": "gzip" };
}

interface TickerEntry {
  cik_str?: number;
  ticker?: string;
  name?: string;
  exchange?: string;
}

const DISTRESS = ["bankruptcy", "chapter 11", "chapter 7", "going concern", "default", "receivership", "liquidation"];

export async function resolveCik(company: string, opts: ClientOpts = {}): Promise<string | null> {
  const res = await fetchJson(TICKERS_URL, { ...opts, headers: secHeaders() });
  if (!res.ok) return null;
  const body = res.json as { data?: TickerEntry[] } | TickerEntry[];
  const rows: TickerEntry[] = Array.isArray(body) ? body : (body.data ?? []);
  const words = company.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !["inc", "llc", "corp", "co", "the"].includes(w));
  let best: { cik: string; score: number } | null = null;
  for (const row of rows) {
    if (!row.cik_str || !row.name) continue;
    const name = row.name.toLowerCase();
    const hits = words.filter((w) => name.includes(w)).length;
    const score = words.length > 0 ? hits / words.length : 0;
    if (score >= 0.6 && (!best || score > best.score)) best = { cik: String(row.cik_str), score };
  }
  return best?.cik ?? null;
}

export async function checkEdgar(company: string, opts: ClientOpts = {}): Promise<SourceResult> {
  const t0 = Date.now();
  const cik = await resolveCik(company, opts);
  if (!cik) return { source: "EDGAR", ok: true, flags: [], latencyMs: Date.now() - t0 };
  const res = await fetchJson(SUB_URL(cik), { ...opts, headers: secHeaders() });
  if (!res.ok) return { ...degraded("EDGAR", res.error), latencyMs: Date.now() - t0 };
  const body = res.json as { filings?: { recent?: { form?: string[]; filingDate?: string[]; primaryDocDescription?: string[] } } };
  const recent = body.filings?.recent;
  const flags: LiveFlag[] = [];
  if (!recent?.form) return { source: "EDGAR", ok: true, flags, latencyMs: Date.now() - t0 };
  const nines = recent.form.filter((f) => f === "8-K").length;
  const tens = recent.form.filter((f) => f === "10-K" || f === "10-Q").length;
  if (tens > 0) {
    flags.push({ text: `${tens} periodic filings on record (10-K/10-Q)`, source: "EDGAR", severity: "info" });
  }
  const descs = (recent.primaryDocDescription ?? []).join(" ").toLowerCase();
  const hit = DISTRESS.find((k) => descs.includes(k));
  if (hit) {
    flags.push({ text: `Distress language in filings: ${hit}`, source: "EDGAR", severity: "critical" });
  } else if (nines >= 6) {
    flags.push({ text: `${nines} 8-K filings recently, elevated activity`, source: "EDGAR", severity: "warn" });
  }
  return { source: "EDGAR", ok: true, flags, latencyMs: Date.now() - t0 };
}
