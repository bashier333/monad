import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveLLM } from "@/lib/core/agent/provider";
import { NvidiaLLM, NVIDIA_BASE_URL, NVIDIA_DEFAULT_MODEL, NVIDIA_FALLBACK_MODEL } from "@/lib/core/agent/nvidia";

// Resolution order is the product contract: NVIDIA Nemotron first for all
// agent work, then Anthropic, then OpenAI. With no keys the resolver throws
// instead of faking a provider: the agent refuses to run rather than invent
// answers. Env is saved/restored around every case.
describe("agent provider resolution (MFG-1001)", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ["NVIDIA_API_KEY", "NVIDIA_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AGENT_MODEL"]) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("prefers NVIDIA Nemotron when its key is set", () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const { llm, provider } = resolveLLM();
    expect(provider).toBe("nvidia");
    expect(llm).toBeInstanceOf(NvidiaLLM);
    expect((llm as NvidiaLLM).modelId).toBe(NVIDIA_DEFAULT_MODEL);
  });

  it("honors NVIDIA_MODEL override", () => {
    process.env.NVIDIA_API_KEY = "test-key";
    process.env.NVIDIA_MODEL = "custom/model";
    const { llm } = resolveLLM();
    expect((llm as NvidiaLLM).modelId).toBe("custom/model");
  });

  it("falls back through anthropic, then openai", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(resolveLLM().provider).toBe("openai");
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(resolveLLM().provider).toBe("anthropic");
  });

  it("throws a configuration error when no keys exist", () => {
    expect(() => resolveLLM()).toThrow(/NVIDIA_API_KEY/);
  });

  it("pins the verified NVIDIA endpoint and default model", () => {
    expect(NVIDIA_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
    expect(NVIDIA_DEFAULT_MODEL).toBe("nvidia/nemotron-3-ultra-550b-a55b");
    expect(NVIDIA_FALLBACK_MODEL).toBe("deepseek-ai/deepseek-v4-flash-0731");
  });
});
