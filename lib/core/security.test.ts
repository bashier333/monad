import { describe, expect, it } from "vitest";
import { signUnsubscribe, verifyUnsubscribe } from "@/lib/core/email";
import {
  appOrigin,
  capString,
  escapeHtml,
  hashEmail,
  isCuid,
  isSafeRedirect,
  parseInviteRole,
  validateInviteEmail,
} from "@/lib/core/security";

describe("security helpers (D1/D2/D4)", () => {
  it("escapes HTML for email/template interpolation (S-341–S-343)", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(`&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;`);
    expect(escapeHtml(`a'b&c`)).toBe(`a&#39;b&amp;c`);
    expect(escapeHtml("plain 123")).toBe("plain 123");
  });

  it("caps echoed values at 100 chars (S-362)", () => {
    expect(capString("x".repeat(500), 100)).toHaveLength(100);
    expect(capString("ok", 100)).toBe("ok");
    expect(capString(123, 100)).toBe("");
  });

  it("hashes emails for logs (no plaintext PII, S-507/S-553)", () => {
    const h1 = hashEmail("Ana@Acme.test");
    const h2 = hashEmail("ana@acme.test");
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(h1).not.toContain("ana");
    expect(h1).not.toContain("acme");
  });

  it("validates redirect targets (S-384, no open redirect)", () => {
    expect(isSafeRedirect("/answers?week=2026-09-07")).toBe(true);
    expect(isSafeRedirect("https://evil.test")).toBe(false);
    expect(isSafeRedirect("//evil.test")).toBe(false);
    expect(isSafeRedirect("/x\\y")).toBe(false);
    expect(isSafeRedirect("/x\r\ny")).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
  });

  it("cuid ids are unguessable-shaped (S-451)", () => {
    expect(isCuid("cm3x8k2p9q4w7e1r5t6y")).toBe(true);
    expect(isCuid("123")).toBe(false);
    expect(isCuid("")).toBe(false);
  });

  it("invite role can never exceed inviter (S-072: owner-only invite, dispatcher/viewer only)", () => {
    expect(parseInviteRole("DISPATCHER")).toBe("DISPATCHER");
    expect(parseInviteRole("VIEWER")).toBe("VIEWER");
    expect(parseInviteRole("OWNER")).toBe("VIEWER");
    expect(parseInviteRole("ADMIN")).toBe("VIEWER");
    expect(parseInviteRole(undefined)).toBe("VIEWER");
  });

  it("invite emails validated (S-453 note: no enumeration via distinct errors)", () => {
    expect(validateInviteEmail("a@b.test")).toEqual({ ok: true, email: "a@b.test" });
    expect(validateInviteEmail("  A@B.TEST ")).toEqual({ ok: true, email: "a@b.test" });
    expect(validateInviteEmail("nope").ok).toBe(false);
    expect(validateInviteEmail("").ok).toBe(false);
  });

  it("app origin prefers env over Host header (S-274/S-275/S-349)", () => {
    process.env.APP_URL = "https://app.example.test";
    expect(appOrigin("http://evil.test/x")).toBe("https://app.example.test");
    delete process.env.APP_URL;
    expect(appOrigin("http://evil.test/x")).toBe("http://evil.test");
  });
});

describe("unsubscribe tokens (S-081–S-083/S-085/S-087)", () => {
  it("HMAC verified, tamper rejected", () => {
    const userId = "u123";
    const token = signUnsubscribe(userId);
    expect(verifyUnsubscribe(userId, token)).toBe(true);
    expect(verifyUnsubscribe(userId, `${token}x`)).toBe(false);
    expect(verifyUnsubscribe(userId, "")).toBe(false);
  });

  it("user-id confusion rejected (A's token fails for B)", () => {
    const tokenA = signUnsubscribe("user-a");
    expect(verifyUnsubscribe("user-b", tokenA)).toBe(false);
    expect(verifyUnsubscribe("user-a", tokenA)).toBe(true);
  });

  it("replay safe: verifying twice still passes (idempotent)", () => {
    const token = signUnsubscribe("u9");
    expect(verifyUnsubscribe("u9", token)).toBe(true);
    expect(verifyUnsubscribe("u9", token)).toBe(true);
  });
});
