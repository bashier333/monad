// Manual live end-to-end agent check against NVIDIA Nemotron (NOT CI —
// needs network + key + a seeded database, and takes several minutes because
// the reasoning model thinks at length). Run:
//   NVIDIA_API_KEY=... NVIDIA_MODEL=nvidia/nemotron-3-ultra-550b-a55b \
//   DATABASE_URL=postgresql://... ORG_ID=<org> npx tsx scripts/agent-live-check.ts
// Proves the full loop on real infrastructure: context → Nemotron decides →
// tools execute → answer passes groundedness evals. The evals route runs on
// the live provider too (see app/api/agent/evals/route.ts).
import { runAgent } from "../lib/core/agent/runtime";
import { NvidiaLLM, NVIDIA_DEFAULT_MODEL } from "../lib/core/agent/nvidia";
import { manufacturingAgentContext } from "../lib/packs/agent";
import { manufacturingToolExecutors } from "../lib/packs/agent-tools";
import { evalAnswer } from "../lib/core/agent/evals";

async function main() {
  const apiKey = process.env.NVIDIA_API_KEY ?? "";
  if (!apiKey) throw new Error("NVIDIA_API_KEY is required");
  const model = process.env.NVIDIA_MODEL ?? NVIDIA_DEFAULT_MODEL;
  const orgId = process.env.ORG_ID ?? "cmu7ga6e60000qj9v9emliaww";
  const ctx = await manufacturingAgentContext(orgId, undefined, { actorRole: "OWNER" });
  console.log("CONTEXT-NODES: " + ctx.nodes.length);
  if (ctx.nodes.length === 0) throw new Error("no objects in context — seed the manufacturing pack first");
  const answer = await runAgent({
    organizationId: orgId,
    actorId: "live-check",
    question: "which lots need reordering?",
    ctx,
    llm: new NvidiaLLM(apiKey, model),
    executors: manufacturingToolExecutors,
    provider: "nvidia",
    maxSteps: 4,
  });
  console.log("STEPS: " + answer.steps.length);
  console.log("CITED: " + answer.citedIds.length);
  console.log("PROPOSALS: " + answer.proposals.length);
  console.log("ANSWER: " + answer.answer.slice(0, 600));
  const verdict = evalAnswer(answer, ctx.nodes.map((n) => n.id));
  console.log("GROUNDED: " + verdict.ok + (verdict.failures.length > 0 ? " FAILURES: " + verdict.failures.join("; ") : ""));
  if (!verdict.ok) throw new Error("answer failed groundedness evals");
  if (answer.citedIds.length === 0) throw new Error("answer cited no objects");
  console.log("LIVE CHECK OK");
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error("LIVE CHECK FAILED:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
);
