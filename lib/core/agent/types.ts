import type { z } from "zod";

// Agent runtime follows the five-layer pattern: deterministic context
// injection (ontology-augmented generation over structured, permission-filtered
// objects), LLM-decided queries within boundaries, a function tool
// (deterministic logic, never rule-fabrication), an action tool (governed,
// human-confirmable), and end-to-end governance (permissions + audit trail).

export interface ToolMessage {
  role: "tool";
  tool: string;
  input: unknown;
  result: unknown;
}

export interface AgentToolDef {
  name: string;
  description: string;
  schema: z.ZodType;
}

export type AgentDecision =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown };

export interface AgentLLM {
  decide(input: { system: string; prompt: string; tools: AgentToolDef[] }): Promise<AgentDecision>;
}

export interface AgentStep {
  n: number;
  decision: AgentDecision;
  result?: unknown;
}

export interface AgentProposal {
  verb: string;
  objectId: string;
  objectKey: string;
  inputs: Record<string, unknown>;
  preview: unknown;
  approvalRequired: boolean;
  allowedRoles: string[];
  latitude: string;
  requestedBy: string;
  lineage: Array<{ tool: string; input: string; citedIds: string[] }>;
}

export interface AgentAnswer {
  answer: string;
  steps: AgentStep[];
  proposals: AgentProposal[];
  citedIds: string[];
  provider: string;
}
