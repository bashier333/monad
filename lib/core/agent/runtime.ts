import type { AgentContext } from "@/lib/core/agent/context";
import { TOOL_SCHEMAS, type ToolExecutors, type ToolName } from "@/lib/core/agent/tools";
import type { AgentAnswer, AgentDecision, AgentLLM, AgentProposal, AgentStep } from "@/lib/core/agent/types";

const SYSTEM = `You run a manufacturing operational model. Rules:
- Answer only from the ontology objects given in context and tool results.
- Every claim must cite an object id like [id].
- Use ontology_logic for numbers (coverage, reorder, risk, forecast). Never invent metrics.
- Use ontology_action only to PROPOSE governed actions. You never write back; proposals wait for a human.
- When you have enough evidence, answer in plain text.`;

export interface RunAgentOpts {
  organizationId: string;
  actorId: string;
  question: string;
  ctx: AgentContext;
  llm: AgentLLM;
  executors: ToolExecutors;
  provider: string;
  maxSteps?: number;
  // Tool name rides along on tool events so clients can map runs onto
  // decision phases honestly (query→observe, logic→orient, action→decide)
  // instead of guessing from summary text.
  onEvent?: (event: { type: string; step: number; text: string; tool?: string }) => void;
}

function toolDefs() {
  return [
    { name: "ontology_query", description: "List objects of a type or traverse the graph from an object id.", schema: TOOL_SCHEMAS.ontology_query },
    { name: "ontology_logic", description: "Run deterministic logic: coverage_days, reorder_suggestion, fulfillment_risk, demand_forecast.", schema: TOOL_SCHEMAS.ontology_logic },
    { name: "ontology_action", description: "Propose a governed manufacturing action (validates only, never executes).", schema: TOOL_SCHEMAS.ontology_action },
  ];
}

function composeAnswer(question: string, commentary: string, steps: AgentStep[], citedIds: string[], proposals: AgentProposal[]): string {
  const lines: string[] = [];
  if (commentary && commentary !== "done") lines.push(commentary);
  const toolLines = steps.filter((s) => s.decision.type === "tool");
  if (toolLines.length === 0) {
    lines.push("No ontology evidence was gathered; nothing grounded could be said.");
  } else {
    for (const s of toolLines) {
      if (s.decision.type !== "tool") continue;
      const report = s.result as { summary?: string } | undefined;
      lines.push(`- ${report?.summary ?? s.decision.name}`);
    }
  }
  if (proposals.length > 0) {
    lines.push("");
    lines.push("Proposed actions (awaiting human confirmation):");
    for (const p of proposals) {
      lines.push(`- ${p.verb} on [${p.objectId}]${p.approvalRequired ? " (approval required)" : ""}`);
    }
  }
  lines.push("");
  lines.push(`Evidence: ${citedIds.length} cited object${citedIds.length === 1 ? "" : "s"} for "${question.slice(0, 80)}".`);
  return lines.join("\n");
}

export async function runAgent(opts: RunAgentOpts): Promise<AgentAnswer> {
  const maxSteps = Math.min(Math.max(opts.maxSteps ?? 6, 1), 12);
  const contextIds = new Set(opts.ctx.nodes.map((n) => n.id));
  const steps: AgentStep[] = [];
  const proposals: AgentProposal[] = [];
  const cited = new Set<string>();
  let commentary = "";
  let n = 0;

  for (n = 1; n <= maxSteps; n++) {
    const history = steps
      .map((s) => {
        if (s.decision.type === "tool") {
          const report = s.result as { summary?: string; result?: unknown } | undefined;
          return `TOOL ${s.decision.name} ${JSON.stringify(s.decision.input)} => ${report?.summary ?? ""} ${JSON.stringify(report?.result ?? null).slice(0, 800)}`;
        }
        return `TEXT ${s.decision.text}`;
      })
      .join("\n");
    const decision: AgentDecision = await opts.llm.decide({
      system: SYSTEM,
      prompt: `CONTEXT:\n${JSON.stringify(opts.ctx.nodes.slice(0, 400)).slice(0, 6000)}\n\nQUESTION:\n${opts.question}\n\nHISTORY:\n${history || "(none)"}`,
      tools: toolDefs(),
    });
    if (decision.type === "text") {
      commentary = decision.text;
      steps.push({ n, decision });
      opts.onEvent?.({ type: "text", step: n, text: decision.text });
      break;
    }
    const executor = opts.executors[decision.name as ToolName];
    if (!executor) {
      steps.push({ n, decision, result: { summary: `unknown tool ${decision.name}`, citedIds: [], result: null } });
      continue;
    }
    const report = await executor(opts.organizationId, opts.actorId, opts.ctx, decision.input).catch((e) => ({
      summary: `tool failed: ${e instanceof Error ? e.message : String(e)}`,
      citedIds: [] as string[],
      result: null as unknown,
      actorId: opts.actorId,
    }));
    for (const id of report.citedIds) if (contextIds.has(id)) cited.add(id);
    const result = { summary: report.summary, result: report.result, actorId: report.actorId ?? opts.actorId };
    steps.push({ n, decision, result });
    opts.onEvent?.({ type: "tool", step: n, text: report.summary, tool: decision.name });
    const proposal = (report.result as { proposal?: unknown } | null)?.proposal as
      | {
          verb: string;
          objectId: string;
          objectKey?: string;
          inputs: Record<string, unknown>;
          effects?: Array<Record<string, unknown>>;
          approvalRequired?: boolean;
          approvalPolicy?: string;
          allowedRoles?: string[];
          latitude?: string;
        }
      | undefined;
    if (decision.name === "ontology_action" && proposal && contextIds.has(proposal.objectId)) {
      proposals.push({
        verb: proposal.verb,
        objectId: proposal.objectId,
        objectKey: proposal.objectKey ?? "",
        inputs: proposal.inputs,
        preview: proposal.effects ?? null,
        approvalRequired: proposal.approvalRequired ?? true,
        allowedRoles: proposal.allowedRoles ?? [],
        latitude: proposal.latitude ?? "confirm",
        requestedBy: opts.actorId,
        lineage: [{ tool: "ontology_action", input: JSON.stringify(decision.input), citedIds: report.citedIds }],
      });
    }
  }

  return {
    answer: composeAnswer(opts.question, commentary, steps, [...cited], proposals),
    steps,
    proposals,
    citedIds: [...cited],
    provider: opts.provider,
  };
}
