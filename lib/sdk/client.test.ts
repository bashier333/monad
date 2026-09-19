import { describe, expect, it } from "vitest";
import { DecisionMemory } from "@/lib/sdk/client";

describe("TS SDK (R-028)", () => {
  it("sends X-API-Key and unwraps the envelope", async () => {
    let seenHeaders: Record<string, string> = {};
    const client = new DecisionMemory({
      baseUrl: "https://api.test",
      apiKey: "dk_abc",
      fetch: (async (url: string | URL, init?: RequestInit) => {
        seenHeaders = (init?.headers ?? {}) as Record<string, string>;
        return new Response(
          JSON.stringify({ data: [{ id: "r1" }], meta: { requestId: "req-1", apiVersion: "2.0.0" } }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    const res = await client.getImports({ limit: 10 });
    expect(seenHeaders["X-API-Key"]).toBe("dk_abc");
    expect(res.data[0].id).toBe("r1");
    expect(res.meta.requestId).toBe("req-1");
  });

  it("throws typed errors from the error envelope", async () => {
    const client = new DecisionMemory({
      baseUrl: "https://api.test",
      apiKey: "dk_bad",
      fetch: (async () =>
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "invalid key", requestId: "r" } }), {
          status: 401,
        })) as typeof fetch,
    });
    await expect(client.getAnswer()).rejects.toThrow(/\[unauthorized\] invalid key/);
  });
});
