import type { CheckReport } from "@/lib/core/livedata/pipeline";

interface Entry {
  report: CheckReport;
  storedAt: number;
}

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 500;

const store = new Map<string, Entry>();

export function cacheKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

export function readCache(company: string, now = Date.now()): CheckReport | null {
  const entry = store.get(cacheKey(company));
  if (!entry) return null;
  if (now - entry.storedAt > TTL_MS) {
    store.delete(cacheKey(company));
    return null;
  }
  return entry.report;
}

export function writeCache(company: string, report: CheckReport, now = Date.now()): void {
  const key = cacheKey(company);
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { report, storedAt: now });
}

export function clearCache(): void {
  store.clear();
}

export function cacheStats(): { size: number } {
  return { size: store.size };
}

export function recentChecks(limit = 10): CheckReport[] {
  return [...store.values()].map((e) => e.report).slice(-limit).reverse();
}
