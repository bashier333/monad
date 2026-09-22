import type { AgentContext } from "@/lib/core/agent/context";
import type { SelectionState } from "@/lib/core/boards/selection";

// ---------------------------------------------------------------------------
// Board agent queries: aip-analyst / aip-chatbot widgets ask grounded
// questions scoped to the live board state. This module composes the scoped
// request for POST /api/agent/run and narrows retrieved context to the
// selection — the agent never sees objects the board isn't showing.
// ---------------------------------------------------------------------------

export interface BoardAgentQuery {
  question: string;
  scope: {
    selectedIds: string[];
    filters: Record<string, unknown>;
    widgetTypes: string[];
  };
  typeKeys?: string[];
}

export function buildBoardAgentQuery(
  state: SelectionState,
  widgetTypes: string[],
  question: string,
  typeKeys?: string[],
): { ok: true; query: BoardAgentQuery } | { ok: false; error: string } {
  const q = question.trim();
  if (q.length < 2) return { ok: false, error: "ask a question of at least 2 characters" };
  if (q.length > 2000) return { ok: false, error: "question exceeds 2000 characters" };
  return {
    ok: true,
    query: {
      question: q,
      scope: {
        selectedIds: state.selectedIds.slice(0, 500),
        filters: state.filters,
        widgetTypes: [...new Set(widgetTypes)].slice(0, 50),
      },
      ...(typeKeys && typeKeys.length > 0 ? { typeKeys: [...new Set(typeKeys)].slice(0, 50) } : {}),
    },
  };
}

// Narrows a retrieved agent context to the board selection (client-side,
// after the governed read). Empty selection keeps everything the board
// shows; unknown ids select nothing — never everything.
export function filterAgentContext(ctx: AgentContext, selectedIds: string[]): AgentContext {
  if (selectedIds.length === 0) return ctx;
  const wanted = new Set(selectedIds);
  return { ...ctx, nodes: ctx.nodes.filter((n) => wanted.has(n.id)), truncated: ctx.truncated };
}
