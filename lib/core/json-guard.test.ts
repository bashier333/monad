import { describe, expect, it } from "vitest";
import { requireJson } from "@/lib/core/json-guard";

describe("content-type guard (S-288)", () => {
  it("accepts application/json with charset", () => {
    const req = new Request("http://x.test", { headers: { "content-type": "application/json; charset=utf-8" } });
    expect(requireJson(req)).toEqual({ ok: true });
  });

  it("rejects anything else with 415", () => {
    for (const ct of ["text/plain", "", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      const req = new Request("http://x.test", { headers: ct ? { "content-type": ct } : {} });
      const res = requireJson(req);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.response.status).toBe(415);
    }
  });
});
