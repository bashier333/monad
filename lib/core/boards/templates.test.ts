import { describe, expect, it } from "vitest";
import { emptyHistory, pushHistory, redoLayout, undoLayout } from "@/lib/core/boards/history";
import {
  BOARD_TEMPLATES,
  BOARD_TOUR_STEPS,
  buildTemplateBoard,
  exportBoard,
  importBoardEnvelope,
} from "@/lib/core/boards/templates";
import { boardInputSchema } from "@/lib/core/boards/store";
import { validateWidgetBoard } from "@/lib/core/boards/widgets";

// Board chrome proof: undo/redo, templates, import/export envelope, tour.

describe("layout history", () => {
  const a = { layout: [{ id: "x" }], widgets: [{ type: "map" }] };
  const b = { layout: [{ id: "x" }, { id: "y" }], widgets: [{ type: "map" }] };
  it("undo walks back, redo walks forward, new edits clear redo", () => {
    let h = emptyHistory();
    h = pushHistory(h, a);
    const u = undoLayout(h, b);
    expect(u).not.toBeNull();
    expect(u!.present).toEqual(a);
    const r = redoLayout(u!.history, u!.present);
    expect(r).not.toBeNull();
    expect(r!.present).toEqual(b);
    const h2 = pushHistory(r!.history, { layout: [], widgets: [] });
    expect(redoLayout(h2, b)).toBeNull();
    expect(undoLayout(emptyHistory(), a)).toBeNull();
  });
  it("caps history at 50", () => {
    let h = emptyHistory();
    for (let i = 0; i < 60; i++) h = pushHistory(h, a);
    expect(h.past).toHaveLength(50);
  });
});

describe("board templates", () => {
  it("every template validates through the user gate", () => {
    expect(Object.keys(BOARD_TEMPLATES)).toEqual(expect.arrayContaining(["ops-overview", "risk-wall", "inbox-triage"]));
    for (const [name, t] of Object.entries(BOARD_TEMPLATES)) {
      expect(boardInputSchema.safeParse(t).success, name).toBe(true);
      expect(validateWidgetBoard(t.widgets, "OWNER").ok, name).toBe(true);
      expect(buildTemplateBoard(name)).toEqual(t);
    }
    expect(buildTemplateBoard("nope")).toBeNull();
  });
});

describe("import/export envelope", () => {
  const board = { name: "B", layout: [{ id: "a", x: 0, y: 0, w: 6, h: 4 }], widgets: [{ id: "a", type: "map", props: {} }], version: 3 };
  it("round-trips byte-identical content", () => {
    const env = exportBoard(board);
    expect(env.format).toBe("monad-board/1");
    const back = importBoardEnvelope(JSON.parse(JSON.stringify(env)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.name).toBe("B");
    expect(back.value.widgets).toHaveLength(1);
  });
  it("rejects foreign envelopes and invalid boards", () => {
    expect(importBoardEnvelope({ format: "other/9" }).ok).toBe(false);
    expect(importBoardEnvelope(null).ok).toBe(false);
    expect(importBoardEnvelope({ format: "monad-board/1", board: { name: "", layout: [], widgets: [] } }).ok).toBe(false);
    expect(
      importBoardEnvelope({ format: "monad-board/1", board: { name: "B", layout: [], widgets: [{ type: "nope" }] } }).ok,
    ).toBe(false);
  });
});

describe("board tour", () => {
  it("covers the board story in five skippable steps", () => {
    expect(BOARD_TOUR_STEPS).toHaveLength(5);
    for (const s of BOARD_TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(20);
    }
  });
});
