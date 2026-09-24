import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentDecision, AgentLLM, AgentToolDef } from "@/lib/core/agent/types";

// NVIDIA NIM hosting Nemotron, reached through its OpenAI-compatible API.
// Three integration facts this file encodes (primary verified against the
// NIM model catalog 2026-09-24):
// 1. The installed SDK defaults to the Responses API (POST /v1/responses),
//    which NIM does not serve (404). We pin .chat() for Chat Completions.
// 2. Nemotron 3 Ultra is a reasoning model: the final answer may arrive
//    with empty content while the thinking sits in reasoningText, and the
//    reasoning consumes the token budget — so we reserve a generous output
//    budget and fall back to the thinking trace rather than "no answer".
// 3. If the primary model is unavailable to the key (404/401/400 from NIM),
//    we retry once on the previous default instead of failing the run.
//    Timeouts and user aborts are never retried.
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const NVIDIA_FALLBACK_MODEL = "deepseek-ai/deepseek-v4-flash-0731";
export const NVIDIA_MAX_OUTPUT_TOKENS = 12000;
// DeepSeek reasons at length before answering (a trivial call measured
// ~110s in Sep 2026) — so every step carries a hard timeout. A hung step
// must fail fast into a retried/errored run, never hang the HTTP connection
// forever. The console Cancel button aborts client-side on top of this.
export const NVIDIA_STEP_TIMEOUT_MS = 240000;

export class NvidiaLLM implements AgentLLM {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  get modelId(): string {
    return this.model;
  }

  async decide(input: { system: string; prompt: string; tools: AgentToolDef[] }): Promise<AgentDecision> {
    try {
      return await this.ask(this.model, input);
    } catch (e) {
      // Never retry hangs or user cancels; never retry when already on the
      // fallback or on an explicit override (NVIDIA_MODEL) the owner chose.
      if (
        this.model === NVIDIA_FALLBACK_MODEL ||
        process.env.NVIDIA_MODEL === this.model ||
        e instanceof DOMException ||
        (e instanceof Error && /abort|timeout|timed out/i.test(e.message))
      ) {
        throw e;
      }
      return this.ask(NVIDIA_FALLBACK_MODEL, input);
    }
  }

  private async ask(
    model: string,
    input: { system: string; prompt: string; tools: AgentToolDef[] }
  ): Promise<AgentDecision> {
    const nvidia = createOpenAI({ baseURL: NVIDIA_BASE_URL, apiKey: this.apiKey });
    const tools: Record<string, ReturnType<typeof tool>> = {};
    for (const t of input.tools) {
      tools[t.name] = tool({ description: t.description, inputSchema: t.schema as never });
    }
    const result = await generateText({
      model: nvidia.chat(model),
      system: input.system,
      prompt: input.prompt,
      tools,
      maxOutputTokens: NVIDIA_MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(NVIDIA_STEP_TIMEOUT_MS),
    });
    const call = result.toolCalls[0];
    if (call && typeof call.toolName === "string") {
      return { type: "tool", name: call.toolName, input: call.input ?? {} };
    }
    const text = result.text || result.reasoningText || "no answer";
    return { type: "text", text };
  }
}
