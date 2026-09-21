import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { runAgent } from "@/lib/core/agent/runtime";
import { resolveLLM } from "@/lib/core/agent/provider";
import type { AgentLLM } from "@/lib/core/agent/types";
import { evalAnswer } from "@/lib/core/agent/evals";
import { manufacturingAgentContext } from "@/lib/packs/agent";
import { manufacturingToolExecutors } from "@/lib/packs/agent-tools";

// Live groundedness evals: scripted questions run through the configured
// provider against live ontology data, scored by the eval assertions (every
// claim cites a context object, no ungrounded proposals). Requires an LLM
// key; without one the route refuses with 503 instead of faking results.
// Results read as regression gates, not judgments.
const EVAL_QUESTIONS = [
  "which orders are at risk of missing SLA?",
  "which lots need reordering?",
  "what is the coverage of my inventory?",
];

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const orgId = active.organization.id;
  const role = active.membership.role;
  const evals: Array<{
    question: string;
    ok: boolean;
    failures: string[];
    proposals: number;
    cited: number;
    steps: number;
  }> = [];
  let llm: AgentLLM;
  let provider: string;
  try {
    ({ llm, provider } = resolveLLM());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "agent LLM not configured" },
      { status: 503 }
    );
  }
  for (const question of EVAL_QUESTIONS) {
    const ctx = await manufacturingAgentContext(orgId, undefined, { actorRole: role });
    const answer = await runAgent({
      organizationId: orgId,
      actorId: userId,
      question,
      ctx,
      llm,
      executors: manufacturingToolExecutors,
      provider,
      maxSteps: 6,
    });
    const verdict = evalAnswer(answer, ctx.nodes.map((n) => n.id));
    evals.push({
      question,
      ok: verdict.ok,
      failures: verdict.failures,
      proposals: answer.proposals.length,
      cited: answer.citedIds.length,
      steps: answer.steps.length,
    });
  }
  const passed = evals.filter((e) => e.ok).length;
  await logAccess(orgId, userId, "agent:evals", `${passed}/${evals.length}`);
  return NextResponse.json({ provider, score: `${passed}/${evals.length}`, evals });
}
