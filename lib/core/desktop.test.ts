import { afterEach, describe, expect, it } from "vitest";
import { desktopBootstrapPath, desktopRewrite, isDesktopMode, isMarketingPath, SESSION_COOKIE } from "@/lib/core/desktop";
import { desktopEmail, normalizeMachineId } from "@/lib/core/desktop-ident";

afterEach(() => {
  delete process.env.MONAD_DESKTOP;
});

describe("desktop mode detection", () => {
  it("is off unless the flag is set", () => {
    expect(isDesktopMode()).toBe(false);
    process.env.MONAD_DESKTOP = "1";
    expect(isDesktopMode()).toBe(true);
  });
});

describe("marketing path matching", () => {
  it("matches the marketing site", () => {
    expect(isMarketingPath("/")).toBe(true);
    expect(isMarketingPath("/platforms/ontology")).toBe(true);
    expect(isMarketingPath("/download")).toBe(true);
    expect(isMarketingPath("/model")).toBe(true);
  });

  it("does not match app, api, or asset paths", () => {
    expect(isMarketingPath("/ontology/twin")).toBe(false);
    expect(isMarketingPath("/workspace")).toBe(false);
    expect(isMarketingPath("/api/desktop")).toBe(false);
    expect(isMarketingPath("/api/ontology/export")).toBe(false);
    expect(isMarketingPath("/dashboard")).toBe(false);
  });
});

describe("desktop identity", () => {
  it("hashes the machine id so raw guids are never stored", () => {
    const a = normalizeMachineId("0aac3b4c-44e8-416a-ba92-777a1ae982fa");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain("0aac3b4c");
    expect(a).toBe(normalizeMachineId("0AAC3B4C-44E8-416A-BA92-777A1AE982FA")); // case-insensitive
  });

  it("derives a stable unique email per machine", () => {
    expect(desktopEmail(normalizeMachineId("a"))).toMatch(/^desktop\.[0-9a-f]{12}@monad\.local$/);
    expect(desktopEmail(normalizeMachineId("a"))).not.toBe(desktopEmail(normalizeMachineId("b")));
  });

  it("names the NextAuth session cookie", () => {
    expect(SESSION_COOKIE).toBe("authjs.session-token");
  });
});

describe("desktop bootstrap predicate (agent-access, no sign-in)", () => {
  it("bootstraps a cookie-less page load in desktop mode", () => {
    process.env.MONAD_DESKTOP = "1";
    expect(desktopBootstrapPath("/", "text/html", "")).toEqual({ path: "/api/desktop/bootstrap" });
    expect(desktopBootstrapPath("/ontology/twin", "text/html", "")).toEqual({ path: "/api/desktop/bootstrap" });
    expect(desktopBootstrapPath("/api/desktop/bootstrap", "text/html", "")).toBeNull();
    expect(desktopBootstrapPath("/api/desktop", "text/html", "")).toBeNull();
    expect(desktopBootstrapPath("/", "text/html", "authjs.session-token=abc")).toBeNull();
    expect(desktopBootstrapPath("/api/ontology/objects", "text/html", "")).toBeNull();
    expect(desktopBootstrapPath("/_next/static/foo.js", "text/html", "")).toBeNull();
  });

  it("leaves everything alone outside desktop mode", () => {
    expect(desktopBootstrapPath("/", "text/html", "")).toBeNull();
  });
});

describe("desktop rewrite", () => {
  it("passes everything through in web mode", () => {
    expect(desktopRewrite("/")).toBeNull();
    expect(desktopRewrite("/platforms/ontology")).toBeNull();
  });

  it("rewrites marketing pages to the workspace in desktop mode", () => {
    process.env.MONAD_DESKTOP = "1";
    expect(desktopRewrite("/")).toBe("/workspace");
    expect(desktopRewrite("/platforms/ontology")).toBe("/workspace");
    expect(desktopRewrite("/download")).toBe("/workspace");
    expect(desktopRewrite("/model")).toBe("/workspace");
  });

  it("leaves app and api routes alone in desktop mode", () => {
    process.env.MONAD_DESKTOP = "1";
    expect(desktopRewrite("/workspace")).toBeNull();
    expect(desktopRewrite("/ontology/twin")).toBeNull();
    expect(desktopRewrite("/api/desktop")).toBeNull();
    expect(desktopRewrite("/api/auth/signin")).toBeNull();
  });
});
