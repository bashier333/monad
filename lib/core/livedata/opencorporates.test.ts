import { describe, expect, it } from "vitest";
import { checkOpenCorporates } from "@/lib/core/livedata/opencorporates";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const ACTIVE = {
  results: {
    companies: [
      {
        company: {
          name: "Cedar Logistics Co",
          company_number: "123",
          jurisdiction_code: "us_tx",
          current_status: "Active",
          registered_address_in_full: "1 Main St",
        },
      },
    ],
  },
};

const DISSOLVED = {
  results: {
    companies: [
      {
        company: {
          name: "Acme Repair LLC",
          company_number: "9",
          jurisdiction_code: "us_tx",
          current_status: "Dissolved",
          dissolution_date: "2024-03-01",
        },
      },
      { company: { name: "Acme Repair Inc", current_status: "Active" } },
    ],
  },
};

describe("opencorporates (LIVE-010-020)", () => {
  it("flags active company as info", async () => {
    const r = await checkOpenCorporates("Cedar", { fetchImpl: (async () => jsonResponse(ACTIVE)) as never });
    expect(r.ok).toBe(true);
    expect(r.flags.some((f) => f.severity === "critical")).toBe(false);
  });
  it("flags dissolved as critical with date", async () => {
    const r = await checkOpenCorporates("Acme", { fetchImpl: (async () => jsonResponse(DISSOLVED)) as never });
    expect(r.flags.some((f) => f.severity === "critical" && f.text.includes("2024-03-01"))).toBe(true);
    expect(r.flags.some((f) => f.text.includes("2 registry matches"))).toBe(true);
  });
  it("returns empty on no match", async () => {
    const r = await checkOpenCorporates("Zzz", { fetchImpl: (async () => jsonResponse({ results: { companies: [] } })) as never });
    expect(r).toMatchObject({ ok: true, flags: [] });
  });
  it("returns empty on empty body", async () => {
    const r = await checkOpenCorporates("Zzz", { fetchImpl: (async () => jsonResponse({})) as never });
    expect(r).toMatchObject({ ok: true, flags: [] });
  });
  it("degrades on 500", async () => {
    const r = await checkOpenCorporates("Zzz", { fetchImpl: (async () => jsonResponse({}, 500)) as never, retries: 0 });
    expect(r.ok).toBe(false);
    expect(r.degraded).toBe(true);
  });
  it("degrades on timeout", async () => {
    const r = await checkOpenCorporates("Zzz", {
      fetchImpl: (async () => {
        throw new Error("timeout");
      }) as never,
      retries: 0,
    });
    expect(r.degraded).toBe(true);
  });
  it("passes api token when given", async () => {
    let seen = "";
    await checkOpenCorporates("Zzz", {
      token: "tok",
      fetchImpl: (async (url: string) => {
        seen = url;
        return jsonResponse({});
      }) as never,
    });
    expect(seen).toContain("api_token=tok");
  });
});
