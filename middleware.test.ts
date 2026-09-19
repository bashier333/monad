import { describe, expect, it } from "vitest";
import { clientIp } from "@/middleware";

describe("client IP resolution (S-063/S-411)", () => {
  it("uses the closest-to-server entry unless a proxy is trusted", () => {
    const spoofed = new Request("http://x.test", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } });
    expect(clientIp(spoofed)).toBe("2.2.2.2");
    const single = new Request("http://x.test", { headers: { "x-forwarded-for": "9.9.9.9" } });
    expect(clientIp(single)).toBe("9.9.9.9");
    const none = new Request("http://x.test");
    expect(clientIp(none)).toBe("unknown");
  });

  it("trusted proxy reads the client entry", () => {
    process.env.TRUSTED_PROXY = "1";
    const req = new Request("http://x.test", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } });
    expect(clientIp(req)).toBe("1.1.1.1");
    delete process.env.TRUSTED_PROXY;
  });

  it("groups IPv6 into /64 for limits (S-069/S-412)", () => {
    const v6 = new Request("http://x.test", { headers: { "x-forwarded-for": "2001:db8:1:2:3:4:5:6" } });
    expect(clientIp(v6)).toBe("2001:db8:1:2::/64");
    const v6b = new Request("http://x.test", { headers: { "x-forwarded-for": "2001:db8:1:2:9:9:9:9" } });
    expect(clientIp(v6b)).toBe(clientIp(v6));
    const v4 = new Request("http://x.test", { headers: { "x-forwarded-for": "9.9.9.9" } });
    expect(clientIp(v4)).toBe("9.9.9.9");
  });

  it("route prefixes are unique (no bucket collisions, S-417)", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    const prefixes = [...src.matchAll(/prefix:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(prefixes.length).toBeGreaterThan(0);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(prefixes).toContain("/api/answers");
    expect(prefixes).toContain("/s/");
  });
});
