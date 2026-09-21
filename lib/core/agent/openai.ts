import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentDecision, AgentLLM, AgentToolDef } from "@/lib/core/agent/types";

export class OpenAILLM implements AgentLLM {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async decide(input: { system: string; prompt: string; tools: AgentToolDef[] }): Promise<AgentDecision> {
    const openai = createOpenAI({ apiKey: this.apiKey });
    const tools: Record<string, ReturnType<typeof tool>> = {};
    for (const t of input.tools) {
      tools[t.name] = tool({ description: t.description, inputSchema: t.schema as never });
    }
    const result = await generateText({
      model: openai(this.model),
      system: input.system,
      prompt: input.prompt,
      tools,
    });
    const call = result.toolCalls[0];
    if (call && typeof call.toolName === "string") {
      return { type: "tool", name: call.toolName, input: call.input ?? {} };
    }
    return { type: "text", text: result.text || "no answer" };
  }
}
