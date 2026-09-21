import { describe, expect, it, vi } from "vitest";
import { fetchJson } from "@/lib/core/livedata/http";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("livedata http (LIVE-001+)", () => {
  it("parses JSON on 200", async () => {
    const res = await fetchJson("https://x.test", { fetchImpl: (async () => jsonResponse({ a: 1 })) as never });
    expect(res).toMatchObject({ ok: true, status: 200 });
  });
  it("maps 404 without retry", async () => {
    const spy = vi.fn(async () => jsonResponse({}, 404));
    const res = await fetchJson("https://x.test", { fetchImpl: spy as never, retries: 3 });
    expect(res).toMatchObject({ ok: false, status: 404 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it("retries 429 then succeeds", async () => {
    let n = 0;
    const flaky = async () => (++n === 1 ? jsonResponse({}, 429) : jsonResponse({ ok: 1 }));
    const res = await fetchJson("https://x.test", { fetchImpl: flaky as never, retries: 2 });
    expect(res.ok).toBe(true);
    expect(n).toBe(2);
  });
  it("gives up after retries on 500", async () => {
    const res = await fetchJson("https://x.test", {
      fetchImpl: (async () => jsonResponse({}, 500)) as never,
      retries: 1,
    });
    expect(res).toMatchObject({ ok: false, error: "http 500" });
  });
  it("maps network failure", async () => {
    const res = await fetchJson("https://x.test", {
      fetchImpl: (async () => {
        throw new Error("boom");
      }) as never,
      retries: 0,
    });
    expect(res).toMatchObject({ ok: false, error: "boom" });
  });
});
