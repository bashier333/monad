import { describe, expect, it } from "vitest";
import {
  API_KEY_SCOPES,
  checkIdempotency,
  checkKeyRate,
  clearIdempotency,
  generateKey,
  hasScope,
  hashKey,
  KEY_TIERS,
  parseScopes,
  storeIdempotency,
} from "@/lib/core/apikeys";

describe("API v2 keys (R-023/R-024/R-025)", () => {
  it("generates, hashes, and scopes keys", () => {
    const { key, hash, prefix } = generateKey();
    expect(key.startsWith("dk_")).toBe(true);
    expect(hashKey(key)).toBe(hash);
    expect(prefix).toBe(key.slice(0, 11));
    const scopes = parseScopes(["read:answers", "bogus"]);
    expect(scopes).toEqual(["read:answers"]);
    expect(hasScope({ scopes }, "read:answers")).toBe(true);
    expect(hasScope({ scopes }, "read:briefs")).toBe(false);
    expect(API_KEY_SCOPES.length).toBe(3);
  });

  it("rate limits per key tier", () => {
    const now = 1_000_000;
    let ok = 0;
    for (let i = 0; i < 125; i++) {
      if (checkKeyRate("standard", "k1", now + i).ok) ok++;
    }
    expect(ok).toBe(KEY_TIERS.standard);
    expect(checkKeyRate("premium", "k2", now).ok).toBe(true);
  });

  it("idempotency keys cache responses for 24h", () => {
    clearIdempotency();
    const now = 1_000_000;
    expect(checkIdempotency("k1", "idem-1", now).cached).toBe(false);
    storeIdempotency("k1", "idem-1", { ok: true }, now);
    expect(checkIdempotency("k1", "idem-1", now + 1000)).toEqual({ cached: true, response: { ok: true } });
    expect(checkIdempotency("k1", "idem-1", now + 25 * 60 * 60 * 1000).cached).toBe(false);
    expect(checkIdempotency("k2", "idem-1", now).cached).toBe(false);
  });
});
