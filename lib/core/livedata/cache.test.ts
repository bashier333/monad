import { describe, expect, it } from "vitest";
import { cacheKey, cacheStats, clearCache, readCache, writeCache } from "@/lib/core/livedata/cache";
import type { CheckReport } from "@/lib/core/livedata/pipeline";

function report(company: string): CheckReport {
  return {
    verdict: "REVIEW",
    score: 60,
    explanation: "test",
    evidence: [],
    degradedSources: [],
    company,
    elapsedMs: 5,
    sourceStates: [],
  };
}

describe("livedata cache (LIVE-221-240)", () => {
  it("normalizes keys", () => {
    expect(cacheKey("  Acme   Inc ")).toBe("acme inc");
  });
  it("stores and hits within TTL", () => {
    clearCache();
    writeCache("Acme", report("Acme"), 1000);
    expect(readCache("acme", 1000 + 60 * 1000)?.company).toBe("Acme");
  });
  it("expires after TTL", () => {
    clearCache();
    writeCache("Acme", report("Acme"), 1000);
    expect(readCache("Acme", 1000 + 16 * 60 * 1000)).toBeNull();
  });
  it("evicts oldest past capacity", () => {
    clearCache();
    for (let i = 0; i < 505; i++) writeCache(`co ${i}`, report(`co ${i}`), 1000);
    expect(cacheStats().size).toBeLessThanOrEqual(500);
    expect(readCache("co 0", 2000)).toBeNull();
    expect(readCache("co 504", 2000)?.company).toBe("co 504");
  });
});
