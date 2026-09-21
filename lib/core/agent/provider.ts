import type { AgentLLM } from "@/lib/core/agent/types";
import { AnthropicLLM } from "@/lib/core/agent/anthropic";
import { OpenAILLM } from "@/lib/core/agent/openai";
import { NvidiaLLM, NVIDIA_DEFAULT_MODEL } from "@/lib/core/agent/nvidia";

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
