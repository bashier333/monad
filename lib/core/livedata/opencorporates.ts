import { fetchJson } from "@/lib/core/livedata/http";
import { degraded, type ClientOpts, type LiveFlag, type SourceResult } from "@/lib/core/livedata/types";

const BASE = "https://api.opencorporates.com/v0.4";

interface OCCompany {
  name?: string;
  company_number?: string;
  jurisdiction_code?: string;
  current_status?: string;
  dissolution_date?: string | null;
  registered_address_in_full?: string | null;
}

function flagsFor(company: OCCompany, query: string): LiveFlag[] {
  const flags: LiveFlag[] = [];
  const status = (company.current_status ?? "").toLowerCase();
  const url = company.jurisdiction_code && company.company_number
    ? `https://opencorporates.com/companies/${company.jurisdiction_code}/${company.company_number}`
    : undefined;
  if (status.includes("dissolved") || status.includes("inactive") || status.includes("struck")) {
    flags.push({
      text: `Registry ${company.current_status}${company.dissolution_date ? ` ${company.dissolution_date}` : ""}`,
      source: "OpenCorporates",
      url,
      severity: "critical",
      at: company.dissolution_date ?? undefined,
    });
  } else if (status && !status.includes("active") && !status.includes("good")) {
    flags.push({ text: `Registry status: ${company.current_status}`, source: "OpenCorporates", url, severity: "warn" });
  }
  if (company.registered_address_in_full) {
    flags.push({ text: `Registered address on file`, source: "OpenCorporates", url, severity: "info" });
  }
  if (flags.length === 0) {
    flags.push({ text: `Registry match for ${query}`, source: "OpenCorporates", url, severity: "info" });
  }
  return flags;
}

export async function checkOpenCorporates(company: string, opts: ClientOpts = {}): Promise<SourceResult> {
  const t0 = Date.now();
  const params = new URLSearchParams({ q: company, per_page: "5" });
  if (opts.token) params.set("api_token", opts.token);
  const res = await fetchJson(`${BASE}/companies/search?${params}`, { ...opts });
  if (!res.ok) return { ...degraded("OpenCorporates", res.error), latencyMs: Date.now() - t0 };
  const results = (res.json as { results?: { companies?: Array<{ company?: OCCompany }> } })?.results?.companies ?? [];
  if (results.length === 0) {
    return { source: "OpenCorporates", ok: true, flags: [], latencyMs: Date.now() - t0 };
  }
  const flags = flagsFor(results[0]!.company ?? {}, company);
  if (results.length > 1) {
    flags.push({ text: `${results.length} registry matches, showing top hit`, source: "OpenCorporates", severity: "info" });
  }
  return { source: "OpenCorporates", ok: true, flags, latencyMs: Date.now() - t0 };
}
