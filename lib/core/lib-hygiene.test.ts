import { describe, expect, it } from "vitest";
import { canonical, fnv1a, stableKey } from "@/lib/idempotency";
import { v2Data, v2Error, v2Headers } from "@/lib/core/api-v2";
import { configuredProviders } from "@/lib/core/auth-providers";
import { isPackId, packEnabled, packOrThrow, PACK_IDS } from "@/lib/core/packs";

// Lib-tail hygiene proof: pure modules without sibling suites get executed
// coverage here (idempotency keys, v2 envelopes, provider flags, packs).

describe("idempotency keys", () => {
  it("canonicalizes key order so retries hash identically", () => {
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
    expect(canonical({ a: [3, 2] })).not.toBe(canonical({ a: [2, 3] }));
    expect(canonical(null)).toBe("null");
  });
  it("fnv1a is stable hex", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });
  it("stableKey binds action+object+approval+inputs", () => {
    const a = stableKey("act", "o1", undefined, { x: 1 });
    expect(a).toBe(stableKey("act", "o1", undefined, { x: 1 }));
    expect(a).not.toBe(stableKey("act", "o1", undefined, { x: 2 }));
    expect(a).not.toBe(stableKey("act", "o2", undefined, { x: 1 }));
    expect(a).toContain("direct");
    expect(stableKey("act", "o1", "appr", { x: 1 })).toContain("appr");
  });
});

describe("v2 envelopes", () => {
  it("headers carry the request id; errors and data share the envelope", async () => {
    expect(v2Headers("r1")).toMatchObject({ "X-Request-Id": "r1" });
    const err = v2Error("r1", "bad", "nope", 400);
    expect(err.status).toBe(400);
    expect(await err.json()).toMatchObject({ error: { code: "bad", requestId: "r1" } });
    const ok = v2Data("r1", { a: 1 }, { p: 2 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ data: { a: 1 }, meta: { p: 2, requestId: "r1" } });
  });
});

describe("configuredProviders", () => {
  it("flags providers only when both id and secret are set", () => {
    const flags = configuredProviders({
      AUTH_GITHUB_ID: "id",
      AUTH_GITHUB_SECRET: "",
      AUTH_GOOGLE_ID: "id",
      AUTH_GOOGLE_SECRET: "secret",
      AUTH_RESEND_KEY: "",
    });
    expect(flags.github).toBe(false);
    expect(flags.google).toBe(true);
    expect(flags.email).toBe(false);
  });
});

describe("packs registry", () => {
  it("knows freight+agency, guards the rest", () => {
    expect([...PACK_IDS]).toEqual(["freight", "agency"]);
    expect(isPackId("freight")).toBe(true);
    expect(isPackId("mfg")).toBe(false);
    expect(packOrThrow("agency")).toBe("agency");
    expect(() => packOrThrow("nope")).toThrow();
    expect(packEnabled({ enabledPacks: ["freight"] }, "freight")).toBe(true);
    expect(packEnabled({ enabledPacks: [] }, "freight")).toBe(false);
    expect(packEnabled({}, "freight")).toBe(true);
  });
});
