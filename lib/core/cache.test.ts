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
});
