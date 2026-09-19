import { db } from "@/lib/core/db";

export interface SearchHit {
  kind: "record" | "brief" | "correction" | "file";
  id: string;
  title: string;
  snippet: string;
  href: string;
}

export interface SearchIssue {
  field: string;
  message: string;
}

export function validateQuery(q: string): SearchIssue[] {
  if (!q || q.trim().length < 2) return [{ field: "q", message: "query must be at least 2 characters" }];
  if (q.length > 200) return [{ field: "q", message: "query too long (max 200)" }];
  return [];
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

export function typoTolerantMatch(text: string, query: string, maxEdits = 2): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (t.includes(q)) return true;
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  const qTokens = q.split(/[^a-z0-9]+/).filter(Boolean);
  for (const qt of qTokens) {
    if (qt.length <= 2) {
      if (tokens.includes(qt)) return true;
      continue;
    }
    for (const tok of tokens) {
      if (levenshtein(tok, qt) <= maxEdits) return true;
    }
  }
  return false;
}

export function snippet(text: string, query: string, width = 80): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, width) + (text.length > width ? "…" : "");
  const start = Math.max(0, idx - width / 2);
  return (start > 0 ? "…" : "") + text.slice(start, start + width) + (start + width < text.length ? "…" : "");
}

const SEARCH_KINDS = new Set(["all", "record", "brief", "correction", "file"]);

export function parseKind(k: string | null): string {
  return k && SEARCH_KINDS.has(k) ? k : "all";
}

export interface SearchAnalytics {
  total: number;
  noResults: number;
}

const analytics: SearchAnalytics = { total: 0, noResults: 0 };

export function trackSearch(hitCount: number): void {
  analytics.total++;
  if (hitCount === 0) analytics.noResults++;
}

export function searchStats(): SearchAnalytics {
  return { ...analytics };
}

export function resetSearchStats(): void {
  analytics.total = 0;
  analytics.noResults = 0;
}

export async function globalSearch(
  orgId: string,
  q: string,
  kind: string,
  packSourceTypes: string[] | null,
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  if (validateQuery(q).length > 0) return hits;

  if (kind === "all" || kind === "record") {
    const staged = await db.stagedRecord.findMany({
      where: {
        organizationId: orgId,
        status: "ok",
        ...(packSourceTypes ? { run: { sourceType: { in: packSourceTypes } } } : {}),
      },
      select: { id: true, loadKey: true, data: true },
      take: 5000,
    });
    for (const s of staged) {
      const d = s.data as Record<string, string>;
      const title = s.loadKey ?? d.loadId ?? d.recordKey ?? `row ${s.id}`;
      const body = [d.project, d.client, d.lane, d.loadId, d.person, d.task].filter(Boolean).join(" · ");
      if (typoTolerantMatch(`${title} ${body}`, q)) {
        hits.push({ kind: "record", id: s.id, title, snippet: snippet(body || title, q), href: `/answers` });
      }
      if (hits.length >= 50) return hits;
    }
  }

  if (kind === "all" || kind === "brief") {
    const briefs = await db.brief.findMany({
      where: { organizationId: orgId },
      select: { id: true, weekStart: true, content: true },
      take: 100,
    });
    for (const b of briefs) {
      const c = b.content as { paragraph?: string };
      const para = c.paragraph ?? "";
      if (typoTolerantMatch(para, q)) {
        hits.push({ kind: "brief", id: b.id, title: `Brief week of ${b.weekStart}`, snippet: snippet(para, q), href: `/briefs/${b.weekStart}` });
      }
      if (hits.length >= 50) return hits;
    }
  }

  if (kind === "all" || kind === "correction") {
    const corrections = await db.correction.findMany({
      where: { organizationId: orgId },
      select: { id: true, targetKey: true, reason: true, field: true },
      take: 500,
    });
    for (const c of corrections) {
      if (typoTolerantMatch(`${c.targetKey} ${c.reason} ${c.field}`, q)) {
        hits.push({ kind: "correction", id: c.id, title: `${c.targetKey} ${c.field}`, snippet: snippet(c.reason, q), href: `/corrections` });
      }
      if (hits.length >= 50) return hits;
    }
  }

  if (kind === "all" || kind === "file") {
    const files = await db.dataFile.findMany({
      where: { organizationId: orgId },
      select: { id: true, filename: true },
      take: 200,
    });
    for (const f of files) {
      if (typoTolerantMatch(f.filename, q)) {
        hits.push({ kind: "file", id: f.id, title: f.filename, snippet: f.filename, href: `/upload` });
      }
    }
  }

  trackSearch(hits.length);
  return hits;
}
