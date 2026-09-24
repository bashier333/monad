import { describe, expect, it, vi, beforeEach } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/core/db", () => ({ db: { providerKey: { findUnique } } }));
vi.mock("@/lib/core/env", () => ({ getEnv: () => ({ AUTH_SECRET: "test-secret-for-provider-keys-1234567890" }) }));

import { encryptProviderKey } from "@/lib/core/agent/org-keys";
import { availableProviders, resolveLLMForOrg } from "@/lib/core/agent/provider";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
  delete process.env.NVIDIA_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env = { ...OLD_ENV, AUTH_SECRET: "test-secret-for-provider-keys-1234567890" };
  delete process.env.NVIDIA_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

function orgRow(raw: string) {
  return { encKey: encryptProviderKey(raw) };
}

describe("org-first provider resolution", () => {
  it("prefers a workspace key over the server key", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { organizationId_provider: { provider: string } } }) =>
      where.organizationId_provider.provider === "anthropic" ? orgRow("anthropic-org-key-123") : null
    );
    process.env.NVIDIA_API_KEY = "nvidia-env-key";
    const r = await resolveLLMForOrg("org-1");
    expect(r.provider).toBe("anthropic");
    expect(r.source).toBe("org");
  });

  it("honors an explicit preference when it has a key", async () => {
    process.env.NVIDIA_API_KEY = "nvidia-env-key";
    process.env.OPENAI_API_KEY = "openai-env-key-long";
    const r = await resolveLLMForOrg("org-1", "openai");
    expect(r.provider).toBe("openai");
  });

  it("lists available providers with sources", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { organizationId_provider: { provider: string } } }) =>
      where.organizationId_provider.provider === "nvidia" ? orgRow("nvapi-org-key-12345") : null
    );
    process.env.OPENAI_API_KEY = "openai-env-key-long";
    expect(await availableProviders("org-1")).toEqual([
      { provider: "nvidia", source: "org" },
      { provider: "openai", source: "env" },
    ]);
  });

  it("throws the helpful error when nothing is configured", async () => {
    await expect(resolveLLMForOrg("org-1")).rejects.toThrow(/NVIDIA_API_KEY/);
  });
});
