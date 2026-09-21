import { z } from "zod";
import type { AgentContext } from "@/lib/core/agent/context";

// Agent tool contracts. The function tool reaches deterministic logic only
// (never rule-fabrication); the action tool can only propose — every proposal
// carries its cited objects and waits for human confirmation.
export const TOOL_SCHEMAS = {
  ontology_query: z.object({
    op: z.enum(["list", "traverse"]),
    type: z.string().max(64).optional(),
    id: z.string().max(64).optional(),
    depth: z.number().int().min(0).max(4).optional(),
  }),
  ontology_logic: z.object({
    fn: z.enum(["coverage_days", "reorder_suggestion", "fulfillment_risk", "demand_forecast"]),
    args: z.record(z.unknown()).default({}),
  }),
  ontology_action: z.object({
    verb: z.string().max(64),
    objectId: z.string().max(64),
    inputs: z.record(z.unknown()).default({}),
  }),
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

export interface ToolReport {
  summary: string;
  citedIds: string[];
  result: unknown;
  // The actor on whose behalf the tool ran. Executors record it; enforcement
  // stays at the preview (latitude), confirm (roles), and audit layers.
  actorId?: string;
}

export interface ToolExecutor {
  (organizationId: string, actorId: string, ctx: AgentContext, input: unknown): Promise<ToolReport>;
}

export type ToolExecutors = Record<ToolName, ToolExecutor>;
