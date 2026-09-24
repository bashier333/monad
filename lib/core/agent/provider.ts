import type { AgentLLM } from "@/lib/core/agent/types";
import { AnthropicLLM } from "@/lib/core/agent/anthropic";
import { OpenAILLM } from "@/lib/core/agent/openai";
import { NvidiaLLM, NVIDIA_DEFAULT_MODEL } from "@/lib/core/agent/nvidia";
import { isOrgKeyProvider, ORG_KEY_PROVIDERS, resolveOrgKey, type OrgKeyProvider } from "@/lib/core/agent/org-keys";

// Provider-agnostic resolution: NVIDIA-hosted DeepSeek behind
// NVIDIA_API_KEY first (the default live model for all agent work), then
// Claude behind ANTHROPIC_API_KEY, GPT behind OPENAI_API_KEY. No fallback:
// without a key the agent refuses to run rather than fake it. Keys stay
// server-side: this module is imported only by server routes, never by
// client components.
export function resolveLLM(): { llm: AgentLLM; provider: string } {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey) {
    return { llm: new NvidiaLLM(nvidiaKey, process.env.NVIDIA_MODEL ?? NVIDIA_DEFAULT_MODEL), provider: "nvidia" };
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return { llm: new AnthropicLLM(anthropicKey, process.env.AGENT_MODEL ?? "claude-sonnet-4-5"), provider: "anthropic" };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { llm: new OpenAILLM(openaiKey, process.env.AGENT_MODEL ?? "gpt-4o-mini"), provider: "openai" };
  }
  throw new Error("agent LLM not configured: set NVIDIA_API_KEY (or ANTHROPIC_API_KEY / OPENAI_API_KEY)");
}

function envKeyFor(provider: OrgKeyProvider): string | null {
  const v =
    provider === "nvidia"
      ? process.env.NVIDIA_API_KEY
      : provider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.OPENAI_API_KEY;
  return v && v.length > 0 ? v : null;
}

// Key lookup for one provider: workspace key first, server env second.
// Presence-only callers (status screens) use availableProviders below.
export async function resolveProviderKey(
  provider: OrgKeyProvider,
  organizationId: string
): Promise<{ key: string; source: "org" | "env" } | null> {
  const orgKey = await resolveOrgKey(organizationId, provider);
  if (orgKey) return { key: orgKey, source: "org" };
  const envKey = envKeyFor(provider);
  if (envKey) return { key: envKey, source: "env" };
  return null;
}

function buildLLM(provider: OrgKeyProvider, key: string): { llm: AgentLLM; provider: string } {
  if (provider === "nvidia") {
    return { llm: new NvidiaLLM(key, process.env.NVIDIA_MODEL ?? NVIDIA_DEFAULT_MODEL), provider: "nvidia" };
  }
  if (provider === "anthropic") {
    return { llm: new AnthropicLLM(key, process.env.AGENT_MODEL ?? "claude-sonnet-4-5"), provider: "anthropic" };
  }
  return { llm: new OpenAILLM(key, process.env.AGENT_MODEL ?? "gpt-4o-mini"), provider: "openai" };
}

// Which providers could answer right now (key presence only, no API calls).
export async function availableProviders(
  organizationId: string
): Promise<Array<{ provider: string; source: "org" | "env" }>> {
  const out: Array<{ provider: string; source: "org" | "env" }> = [];
  for (const provider of ORG_KEY_PROVIDERS) {
    if (!isOrgKeyProvider(provider)) continue;
    const found = await resolveProviderKey(provider, organizationId);
    if (found) out.push({ provider, source: found.source });
  }
  return out;
}

// Organization resolution: an explicit preference wins when it has a key;
// otherwise workspace keys beat the server default, provider by provider
// (nvidia, then anthropic, then openai). Falls back to resolveLLM() so
// single-key server setups keep working.
export async function resolveLLMForOrg(
  organizationId: string,
  preferred?: OrgKeyProvider
): Promise<{ llm: AgentLLM; provider: string; source: "org" | "env" }> {
  const order = preferred && isOrgKeyProvider(preferred)
    ? [preferred, ...ORG_KEY_PROVIDERS.filter((p) => p !== preferred && isOrgKeyProvider(p))]
    : [...ORG_KEY_PROVIDERS].filter(isOrgKeyProvider);
  // Workspace keys beat server keys, in priority order; then server keys in
  // priority order. An explicit preference moves to the front of both lines.
  for (const provider of order) {
    const orgKey = await resolveOrgKey(organizationId, provider);
    if (!orgKey) continue;
    const { llm, provider: name } = buildLLM(provider, orgKey);
    return { llm, provider: name, source: "org" as const };
  }
  for (const provider of order) {
    const key = envKeyFor(provider);
    if (!key) continue;
    const { llm, provider: name } = buildLLM(provider, key);
    return { llm, provider: name, source: "env" as const };
  }
  const { llm, provider } = resolveLLM();
  return { llm, provider, source: "env" };
}
