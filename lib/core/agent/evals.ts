import type { AgentAnswer } from "@/lib/core/agent/types";

// Grounded-answer assertions: answers must cite real context objects and
// proposals must reference objects that exist in context (no ungrounded
// actions, no hallucinated ids).
export function assertAnswerCitesObjects(answer: AgentAnswer, contextIds: string[]): { ok: boolean; missing: string[] } {
  const ids = new Set(contextIds);
  const mentioned = [...answer.answer.matchAll(/\[([a-zA-Z0-9_-]+)\]/g)].map((m) => m[1]!);
  const missing = [...new Set(mentioned.filter((id) => !ids.has(id)))];
  return { ok: answer.citedIds.length > 0 && missing.length === 0, missing };
}

export function assertNoUngroundedProposals(answer: AgentAnswer, contextIds: string[]): { ok: boolean; ungrounded: string[] } {
  const ids = new Set(contextIds);
  const ungrounded = answer.proposals.filter((p) => !ids.has(p.objectId)).map((p) => p.objectId);
  return { ok: ungrounded.length === 0, ungrounded };
}

export function evalAnswer(answer: AgentAnswer, contextIds: string[]): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const citations = assertAnswerCitesObjects(answer, contextIds);
  if (!citations.ok) {
    if (answer.citedIds.length === 0) failures.push("answer cites no objects");
    if (citations.missing.length > 0) failures.push(`answer mentions unknown ids: ${citations.missing.join(", ")}`);
  }
  const grounded = assertNoUngroundedProposals(answer, contextIds);
  if (!grounded.ok) failures.push(`ungrounded proposals: ${grounded.ungrounded.join(", ")}`);
  return { ok: failures.length === 0, failures };
}
