import { describe, expect, it } from "vitest";
import {
  boardWidgetTypes,
  canManageBoard,
  diffBoardLayout,
  layoutNote,
} from "@/lib/core/boards/store";

// Board store pure proof: layout diffs, ownership rule, widget filtering.
// DB paths (create/update/revert/publish/share) follow the tested
// registry.ts patterns and are covered by route contract tests.

describe("diffBoardLayout", () => {
  it("separates added/removed/kept by widget id", () => {
    const d = diffBoardLayout([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
    expect(d).toEqual({ added: ["c"], removed: ["a"], kept: ["b"] });
    expect(diffBoardLayout([], [])).toEqual({ added: [], removed: [], kept: [] });
  });
  it("layoutNote names the next version with counts", () => {
    expect(layoutNote([{ id: "a" }], [{ id: "a" }, { id: "b" }], 3)).toBe("v4: +1 widgets, -0 widgets");
  });
});

describe("canManageBoard", () => {
  it("owner manages own boards; OWNER manages all; others blocked", () => {
    const board = { ownerId: "u1" };
    expect(canManageBoard(board, "u1", "DISPATCHER")).toBe(true);
    expect(canManageBoard(board, "u9", "OWNER")).toBe(true);
    expect(canManageBoard(board, "u9", "DISPATCHER")).toBe(false);
    expect(canManageBoard(board, "u9", "VIEWER")).toBe(false);
  });
});

describe("boardWidgetTypes", () => {
  it("dedupes known types and drops unknown ones", () => {
    expect(boardWidgetTypes([{ type: "map" }, { type: "map" }, { type: "nope" }])).toEqual(["map"]);
    expect(boardWidgetTypes([])).toEqual([]);
  });
});
