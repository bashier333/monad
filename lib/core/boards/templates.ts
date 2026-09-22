import { boardInputSchema, type BoardInput } from "@/lib/core/boards/store";
import { validateWidgetBoard } from "@/lib/core/boards/widgets";

// ---------------------------------------------------------------------------
// Board templates, import/export envelope, and tour copy. Templates are pure
// BoardInput builders validated through the same gate as user boards —
// a template that fails validation fails the suite, never ships.
// ---------------------------------------------------------------------------

function grid(ids: string[]): Array<{ id: string; x: number; y: number; w: number; h: number }> {
  return ids.map((id, i) => ({ id, x: (i % 2) * 6, y: Math.floor(i / 2) * 4, w: 6, h: 4 }));
}

export const BOARD_TEMPLATES: Record<string, BoardInput> = {
  "ops-overview": {
    name: "Ops overview",
    layout: grid(["map", "timeline", "metrics", "risks"]),
    widgets: [
      { id: "map", type: "map", props: {} },
      { id: "timeline", type: "timeline", props: { limit: 20 } },
      { id: "metrics", type: "metric-card", props: { format: "int" } },
      { id: "risks", type: "object-list", props: {} },
    ],
  },
  "risk-wall": {
    name: "Risk wall",
    layout: grid(["chart", "table", "alerts", "detail"]),
    widgets: [
      { id: "chart", type: "chart-xy", props: { form: "bar" } },
      { id: "table", type: "object-table", props: { typeKey: "mfg_shipment" } },
      { id: "alerts", type: "filter-list", props: { field: "status" } },
      { id: "detail", type: "object-view", props: {} },
    ],
  },
  "inbox-triage": {
    name: "Inbox triage",
    layout: grid(["queue", "detail", "actions", "history"]),
    widgets: [
      { id: "queue", type: "object-list", props: {} },
      { id: "detail", type: "object-view", props: {} },
      { id: "actions", type: "button-group", props: { actionKey: "mfg_resolve_delay" } },
      { id: "history", type: "edit-history", props: {} },
    ],
  },
};

export function buildTemplateBoard(name: string): BoardInput | null {
  const t = BOARD_TEMPLATES[name];
  if (!t) return null;
  return JSON.parse(JSON.stringify(t)) as BoardInput;
}

export interface BoardEnvelope {
  format: "monad-board/1";
  exportedAt: string;
  board: { name: string; layout: unknown[]; widgets: unknown[]; version: number };
}

export function exportBoard(board: { name: string; layout: unknown; widgets: unknown; version: number }): BoardEnvelope {
  return {
    format: "monad-board/1",
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      layout: Array.isArray(board.layout) ? board.layout : [],
      widgets: Array.isArray(board.widgets) ? board.widgets : [],
      version: board.version,
    },
  };
}

export function importBoardEnvelope(input: unknown): { ok: true; value: BoardInput } | { ok: false; error: string } {
  const env = input as Partial<BoardEnvelope> | null;
  if (!env || env.format !== "monad-board/1" || !env.board) {
    return { ok: false, error: "not a monad-board/1 envelope" };
  }
  const parsed = boardInputSchema.safeParse({
    name: env.board.name,
    layout: env.board.layout,
    widgets: env.board.widgets,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  const gate = validateWidgetBoard(parsed.data.widgets, "OWNER");
  const blocking = gate.problems.filter((p) => !p.message.includes("not visible to"));
  if (blocking.length > 0) {
    return { ok: false, error: blocking.map((p) => `${p.type}: ${p.message}`).join("; ") };
  }
  return { ok: true, value: parsed.data };
}

export interface BoardTourStep {
  target?: string;
  title: string;
  body: string;
}

export const BOARD_TOUR_STEPS: BoardTourStep[] = [
  {
    title: "Your board, your operation",
    body: "One canvas watches the operation. Every card below is live: change a filter and the whole board follows. Nothing here is a screenshot.",
  },
  {
    title: "Filter once, filter everywhere",
    body: "The filter bar publishes to every widget through the selection bus. Set a region or status and tables, charts and maps narrow together.",
  },
  {
    title: "Every figure has receipts",
    body: "Click any number to open its evidence — source rows, facts and the rule that produced it. A figure without a source is a rumor.",
  },
  {
    title: "Actions propose, humans dispose",
    body: "Buttons open governed action forms. Proposals wait for approval; autonomous writes stay fenced behind the auto gate and the kill switch.",
  },
  {
    title: "Boards version like code",
    body: "Every layout change snapshots. Revert any version in one click, publish when ready, and share read-only links that revoke instantly.",
  },
];
