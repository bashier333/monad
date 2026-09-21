import { describe, expect, it } from "vitest";
import { checkCourtListener } from "@/lib/core/livedata/courtlistener";
import { checkEdgar } from "@/lib/core/livedata/edgar";
import { checkGdelt } from "@/lib/core/livedata/gdelt";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("courtlistener (LIVE-034-043)", () => {
  it("flags docket volume by severity", async () => {
    const many = { count: 7, results: [{ caseName: "A v B", dateFiled: "2024-01-01" }] };
    const r = await checkCourtListener("Acme", { fetchImpl: (async () => jsonResponse(many)) as never });
    expect(r.flags[0]).toMatchObject({ severity: "critical" });
    expect(r.flags.some((f) => f.text === "A v B")).toBe(true);
  });
  it("returns empty on zero count", async () => {
    const r = await checkCourtListener("Zzz", { fetchImpl: (async () => jsonResponse({ count: 0, results: [] })) as never });
    expect(r).toMatchObject({ ok: true, flags: [] });
  });
  it("degrades on auth wall", async () => {
    const r = await checkCourtListener("Zzz", { fetchImpl: (async () => jsonResponse({}, 403)) as never });
    expect(r.degraded).toBe(true);
  });
  it("sends token when given", async () => {
    let auth = "";
    await checkCourtListener("Zzz", {
      token: "t",
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        auth = String(init?.headers ? (init.headers as Record<string, string>).Authorization : "");
        return jsonResponse({ count: 0, results: [] });
      }) as never,
    });
    expect(auth).toBe("Token t");
  });
});

describe("edgar (LIVE-059-068)", () => {
  const tickers = { data: [{ cik_str: 123, ticker: "ACME", name: "Acme Repair Corp" }] };
  const subs = {
    filings: {
      recent: {
        form: ["10-K", "8-K", "8-K", "8-K", "8-K", "8-K", "8-K"],
        filingDate: ["2024-01-01"],
        primaryDocDescription: ["Annual report"],
      },
    },
  };
  it("flags periodic filings and elevated 8-K activity", async () => {
    const calls: string[] = [];
    const r = await checkEdgar("Acme Repair", {
      fetchImpl: (async (u: string) => {
        calls.push(u);
        return jsonResponse(u.includes("company_tickers") ? tickers : subs);
      }) as never,
    });
    expect(r.ok).toBe(true);
    expect(r.flags.some((f) => f.text.includes("periodic filings"))).toBe(true);
    expect(r.flags.some((f) => f.severity === "warn")).toBe(true);
  });
  it("flags distress language as critical", async () => {
    const bad = { filings: { recent: { form: ["8-K"], filingDate: [], primaryDocDescription: ["Chapter 11 filing"] } } };
    const r = await checkEdgar("Acme Repair", {
      fetchImpl: (async (u: string) => jsonResponse(u.includes("company_tickers") ? tickers : bad)) as never,
    });
    expect(r.flags.some((f) => f.severity === "critical" && f.text.includes("chapter 11"))).toBe(true);
  });
  it("returns empty when no CIK match", async () => {
    const r = await checkEdgar("Zzz Shop", {
      fetchImpl: (async () => jsonResponse({ data: [{ cik_str: 1, ticker: "X", name: "Other Corp" }] })) as never,
    });
    expect(r).toMatchObject({ ok: true, flags: [] });
  });
  it("sends SEC user agent", async () => {
    let ua = "";
    await checkEdgar("Zzz", {
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        ua = String((init?.headers as Record<string, string>)?.["User-Agent"] ?? "");
        return jsonResponse({ data: [] });
      }) as never,
    });
    expect(ua).toContain("LenderEye");
  });
});

describe("gdelt (LIVE-083-092)", () => {
  const arts = {
    articles: [
      { title: "Acme sued over unpaid bills", url: "https://x/1", seendate: "20240101", tone: "-6", language: "English" },
      { title: "Acme misses payroll", url: "https://x/2", seendate: "20240102", tone: "-5", language: "English" },
    ],
  };
  it("flags negative tone", async () => {
    const r = await checkGdelt("Acme", { fetchImpl: (async () => jsonResponse(arts)) as never });
    expect(r.flags.some((f) => f.severity === "warn" && f.text.includes("tone"))).toBe(true);
    expect(r.flags.some((f) => f.text.includes("unpaid bills"))).toBe(true);
  });
  it("returns empty on no articles", async () => {
    const r = await checkGdelt("Zzz", { fetchImpl: (async () => jsonResponse({ articles: [] })) as never });
    expect(r).toMatchObject({ ok: true, flags: [] });
  });
  it("ignores non-english articles", async () => {
    const r = await checkGdelt("Zzz", {
      fetchImpl: (async () => jsonResponse({ articles: [{ title: "Hola", tone: "-9", language: "Spanish" }] })) as never,
    });
    expect(r.flags).toHaveLength(0);
  });
});
