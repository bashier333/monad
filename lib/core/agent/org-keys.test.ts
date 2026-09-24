import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/core/db", () => ({ db: {} }));
vi.mock("@/lib/core/env", () => ({ getEnv: () => ({ AUTH_SECRET: "test-secret-for-provider-keys-1234567890" }) }));

import { decryptProviderKey, encryptProviderKey, isOrgKeyProvider, keyHint } from "@/lib/core/agent/org-keys";

describe("provider key crypto", () => {
  it("round-trips through AES-GCM", () => {
    const enc = encryptProviderKey("nvapi-secret-value-123");
    expect(enc).not.toContain("nvapi-secret");
    expect(decryptProviderKey(enc)).toBe("nvapi-secret-value-123");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptProviderKey("same")).not.toBe(encryptProviderKey("same"));
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptProviderKey("not.a.key.at.all.x")).toThrow();
    expect(() => decryptProviderKey("garbage")).toThrow(/malformed/);
  });

  it("masks to a last-4 hint", () => {
    expect(keyHint("nvapi-abcdef1234")).toBe("ends 1234");
    expect(keyHint("   ")).toBe("");
  });

  it("validates provider names", () => {
    expect(isOrgKeyProvider("nvidia")).toBe(true);
    expect(isOrgKeyProvider("anthropic")).toBe(true);
    expect(isOrgKeyProvider("openai")).toBe(true);
    expect(isOrgKeyProvider("azure")).toBe(false);
    expect(isOrgKeyProvider("")).toBe(false);
    expect(isOrgKeyProvider(undefined)).toBe(false);
  });
});
