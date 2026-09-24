import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import { runAgent } from "@/lib/core/agent/runtime";
import { resolveLLM } from "@/lib/core/agent/provider";
import type { AgentLLM } from "@/lib/core/agent/types";
import { manufacturingAgentContext } from "@/lib/packs/agent";
import { manufacturingToolExecutors } from "@/lib/packs/agent-tools";

export async function GET() {
  // Provider status for the console: shows which AI backend answers, or
  // plainly that no key is set (with the exact variable name) instead of
  // failing mysteriously on the first question.
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { provider } = resolveLLM();
    return NextResponse.json({ configured: true, provider });
  } catch (e) {
    return NextResponse.json({
      configured: false,
      provider: null,
      hint: e instanceof Error ? e.message : "agent LLM not configured",
    });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { question?: string; typeKeys?: string[]; maxSteps?: number };
  const question = String(body.question ?? "").slice(0, 2000).trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  const typeKeys = Array.isArray(body.typeKeys) ? body.typeKeys.filter((t) => typeof t === "string").slice(0, 20) : undefined;
  const orgId = active.organization.id;
  const ctx = await manufacturingAgentContext(orgId, typeKeys, { actorRole: active.membership.role });
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

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const answer = await runAgent({
          organizationId: orgId,
          actorId: userId,
          question,
          ctx,
          llm,
          executors: manufacturingToolExecutors,
          provider,
          maxSteps: body.maxSteps,
          onEvent: (e) => send(e),
        });
        await logAccess(orgId, userId, "agent:run", `${provider}:${answer.proposals.length}`);
        send({ type: "done", answer: answer.answer, proposals: answer.proposals, citedIds: answer.citedIds, provider });
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : "agent run failed" });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" },
  });
}
