import { checkRate } from "@/lib/ratelimit";
import { describe, expect, it } from "vitest";

describe("token bucket (B-097)", () => {
  it("allows up to the limit then rejects with retry-after", async () => {
    const { checkRate: check, clearRateBuckets } = await import("@/lib/ratelimit");
    clearRateBuckets();
    expect(check("k1", 2, 60_000, 1000).ok).toBe(true);
    expect(check("k1", 2, 60_000, 1001).ok).toBe(true);
    const third = check("k1", 2, 60_000, 1002);
    expect(third.ok).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
    expect(check("k1", 2, 60_000, 61_001).ok).toBe(true);
  });

  it("isolates keys", () => {
    expect(checkRate("a", 1, 60_000, 2000).ok).toBe(true);
    expect(checkRate("b", 1, 60_000, 2000).ok).toBe(true);
    expect(checkRate("a", 1, 60_000, 2001).ok).toBe(false);
  });
});
