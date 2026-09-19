import { describe, expect, it } from "vitest";
import {
  levenshtein,
  parseKind,
  resetSearchStats,
  searchStats,
  snippet,
  trackSearch,
  typoTolerantMatch,
  validateQuery,
} from "@/lib/core/search";

describe("search lib (R-052/R-054/R-055/R-056/R-058)", () => {
  it("validates queries", () => {
    expect(validateQuery("acme")).toEqual([]);
    expect(validateQuery("a").map((i) => i.field)).toEqual(["q"]);
    expect(validateQuery("x".repeat(201)).map((i) => i.field)).toEqual(["q"]);
  });

  it("typo-tolerant matching (≤2 edits + contains)", () => {
    expect(typoTolerantMatch("Acme Site", "acme")).toBe(true);
    expect(typoTolerantMatch("Acme Site", "akme")).toBe(true);
    expect(typoTolerantMatch("Acme Site", "acm site")).toBe(true);
    expect(typoTolerantMatch("Acme Site", "zzzzz")).toBe(false);
    expect(levenshtein("acme", "akme")).toBe(1);
  });

  it("snippets center on the match", () => {
    expect(snippet("a".repeat(50) + "NEEDLE" + "b".repeat(50), "needle")).toMatch(/NEEDLE/);
    expect(snippet("short", "needle")).toBe("short");
  });

  it("search analytics track hits + misses", () => {
    resetSearchStats();
    trackSearch(5);
    trackSearch(0);
    trackSearch(3);
    expect(searchStats()).toEqual({ total: 3, noResults: 1 });
  });

  it("kind parsing defaults to all", () => {
    expect(parseKind("brief")).toBe("brief");
    expect(parseKind("pigeon")).toBe("all");
    expect(parseKind(null)).toBe("all");
  });

  it("matching 5k rows stays under the 300ms budget (R-058 local sanity)", () => {
    const rows: string[] = [];
    for (let i = 0; i < 5000; i++) rows.push(`Project${i % 100} · Client${i % 20} · task${i} · person${i % 10}`);
    const t0 = Date.now();
    let hits = 0;
    for (const r of rows) {
      if (typoTolerantMatch(r, "project7")) hits++;
    }
    expect(Date.now() - t0).toBeLessThan(300);
    expect(hits).toBeGreaterThan(0);
  });
});
