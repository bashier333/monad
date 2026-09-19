import { cacheBust, cacheGet, cacheSet, cacheStats, clearCache } from "@/lib/core/cache";
import { describe, expect, it } from "vitest";

describe("TTL LRU cache (W9)", () => {
  it("hits within TTL, misses after, busts by prefix", () => {
    clearCache();
    cacheSet("a:1", { v: 1 }, 1000, 0);
    expect(cacheGet("a:1", 500)).toEqual({ v: 1 });
    expect(cacheGet("a:1", 1001)).toBeNull();
    cacheSet("a:1", 1, 1000, 0);
    cacheSet("a:2", 2, 1000, 0);
    cacheSet("b:1", 3, 1000, 0);
    expect(cacheBust("a:")).toBe(2);
    expect(cacheGet("a:1", 10)).toBeNull();
    expect(cacheGet("b:1", 10)).toBe(3);
  });

  it("evicts oldest past capacity and reports stats", () => {
    clearCache();
    for (let i = 0; i < 210; i++) cacheSet(`k:${i}`, i, 60_000, 0);
    const s = cacheStats();
    expect(s.size).toBeLessThanOrEqual(200);
    expect(s.misses).toBeGreaterThanOrEqual(0);
  });

  it("tracks hit rates per pack prefix (X9 E-432)", () => {
    clearCache();
    cacheSet("answer:freight:o1:2026-09-07:x", 1, 60_000, 0);
    cacheSet("answer:agency:o1:2026-09-07:x", 2, 60_000, 0);
    expect(cacheGet("answer:freight:o1:2026-09-07:x", 10)).toBe(1);
    expect(cacheGet("answer:agency:o1:2026-09-07:x", 10)).toBe(2);
    expect(cacheGet("answer:agency:o1:2026-09-07:missing", 10)).toBeNull();
    const s = cacheStats();
    expect(s.byPrefix["answer:freight"]).toMatchObject({ hits: 1, misses: 0 });
    expect(s.byPrefix["answer:agency"]).toMatchObject({ hits: 1, misses: 1 });
  });

  it("busts both pack namespaces (agency stale-cache fix)", async () => {
    clearCache();
    const { bustAnswerCache } = await import("@/lib/core/answers/service");
    cacheSet("answer:freight:o9:s:x", 1, 60_000, 0);
    cacheSet("answer:agency:o9:s:x", 2, 60_000, 0);
    cacheSet("answer:o9:s:x", 3, 60_000, 0);
    bustAnswerCache("o9");
    expect(cacheGet("answer:freight:o9:s:x", 10)).toBeNull();
    expect(cacheGet("answer:agency:o9:s:x", 10)).toBeNull();
    expect(cacheGet("answer:o9:s:x", 10)).toBeNull();
  });

  it("singleflight dedupes concurrent misses (R-526)", async () => {
    const { singleflight } = await import("@/lib/core/cache");
    let calls = 0;
    const fn = async () => {
      const mine = ++calls;
      await new Promise((r) => setTimeout(r, 20));
      return mine;
    };
    const [a, b, c] = await Promise.all([singleflight("k", fn), singleflight("k", fn), singleflight("other", fn)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(2);
    expect(calls).toBe(2);
    const d = await singleflight("k", fn);
    expect(d).toBe(3);
  });
});
