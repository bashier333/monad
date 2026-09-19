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
});
