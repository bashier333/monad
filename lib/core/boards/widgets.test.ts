import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_BUS_EVENTS,
  SOURCE_ROUTES,
  WIDGETS,
  getWidget,
  validateWidgetBoard,
  validateWidgetProps,
} from "@/lib/core/boards/widgets";

// Widget catalog proof (F2-04151+): 70 typed definitions, unique keys,
// bus-restricted events, real route contracts, prop schemas that reject,
// budgets matching laziness, and a doc that names every key.

const BUS = new Set<string>(BOARD_BUS_EVENTS);

describe("catalog completeness", () => {
  it("holds all 70 Workshop-parity widgets with unique keys", () => {
    expect(WIDGETS).toHaveLength(70);
    expect(new Set(WIDGETS.map((w) => w.type)).size).toBe(70);
    for (const w of WIDGETS) {
      expect(w.title.length, w.type).toBeGreaterThan(0);
      expect(w.description.length, w.type).toBeGreaterThan(0);
      expect(w.keyboardOps.length, w.type).toBeGreaterThan(0);
    }
  });
  it("getWidget resolves and rejects honestly", () => {
    expect(getWidget("map")?.family).toBe("visualization");
    expect(getWidget("nope")).toBeNull();
  });
});

describe("events stay on the selection bus", () => {
  it("every eventsIn/eventsOut verb is bus vocabulary", () => {
    for (const w of WIDGETS) {
      for (const e of [...w.eventsIn, ...w.eventsOut]) {
        expect(BUS.has(e), `${w.type}:${e}`).toBe(true);
      }
    }
  });
  it("filters publish, displays subscribe", () => {
    for (const w of WIDGETS.filter((x) => x.family === "filtering")) {
      expect(w.eventsOut).toContain("filter.set");
    }
    for (const w of WIDGETS.filter((x) => x.family === "display")) {
      expect(w.eventsIn).toContain("selection.set");
    }
  });
});

describe("query contracts point at real routes", () => {
  it("every data source maps to a versioned ontology/agent route", () => {
    for (const w of WIDGETS) {
      const route = SOURCE_ROUTES[w.dataSource];
      if (w.dataSource === "none") {
        expect(route).toBeNull();
        continue;
      }
      expect(route, w.type).toMatch(/^\/api\/(ontology|agent)\//);
    }
  });
  it("roles are valid and viewers never write", () => {
    for (const w of WIDGETS) {
      expect(w.roles.length, w.type).toBeGreaterThan(0);
      for (const r of w.roles) expect(["OWNER", "DISPATCHER", "VIEWER"]).toContain(r);
    }
    for (const w of WIDGETS.filter((x) => x.family === "event")) {
      expect(w.roles).not.toContain("VIEWER");
    }
  });
});

describe("perf budgets match laziness", () => {
  it("heavy viz loads lazily; light widgets stay under 150kB", () => {
    for (const w of WIDGETS) {
      expect(w.perfBudgetKb, w.type).toBeGreaterThan(0);
      if (!w.lazy) expect(w.perfBudgetKb, w.type).toBeLessThanOrEqual(150);
      else expect(w.perfBudgetKb, w.type).toBeGreaterThanOrEqual(150);
    }
    expect(WIDGETS.filter((w) => w.lazy).length).toBeGreaterThan(10);
  });
});

describe("prop schemas accept and reject", () => {
  it("object-table requires a typeKey", () => {
    expect(validateWidgetProps("object-table", {}).ok).toBe(false);
    expect(validateWidgetProps("object-table", { typeKey: "shipment" }).ok).toBe(true);
  });
  it("pie slices clamp to 2–5; limits clamp to 1–200", () => {
    expect(validateWidgetProps("pie-chart", { slices: 9 }).ok).toBe(false);
    expect(validateWidgetProps("pie-chart", { slices: 3 }).ok).toBe(true);
    expect(validateWidgetProps("object-list", { limit: 500 }).ok).toBe(false);
  });
  it("action widgets require an actionKey; decorative ones do not", () => {
    expect(validateWidgetProps("button-group", {}).ok).toBe(false);
    expect(validateWidgetProps("button-group", { actionKey: "mfg_resolve_delay" }).ok).toBe(true);
    expect(validateWidgetProps("comments", {}).ok).toBe(true);
  });
  it("unknown widgets fail loudly", () => {
    expect(validateWidgetProps("teleport", {})).toMatchObject({ ok: false });
  });
});

describe("states and docs", () => {
  it("data widgets name their empty state", () => {
    for (const w of WIDGETS.filter((x) => x.dataSource !== "none")) {
      expect(w.emptyState.length, w.type).toBeGreaterThan(0);
    }
  });
  it("the catalog doc names every widget key", () => {
    const doc = readFileSync(join(process.cwd(), "(marketing)", "docs", "boards-widget-catalog.md"), "utf8");
    for (const w of WIDGETS) {
      expect(doc, w.type).toContain(`\`${w.type}\``);
    }
  });
});

describe("media contracts gate sources", () => {
  it("http and non-URL sources rejected; https accepted", () => {
    expect(validateWidgetProps("video-display", { src: "http://x.test/v.mp4" }).ok).toBe(false);
    expect(validateWidgetProps("video-display", { src: "not a url" }).ok).toBe(false);
    expect(validateWidgetProps("video-display", { src: "https://x.test/v.mp4" }).ok).toBe(true);
    expect(validateWidgetProps("pdf-viewer", { src: "https://x.test/b.pdf", page: 0 }).ok).toBe(false);
    expect(validateWidgetProps("pdf-viewer", { src: "https://x.test/b.pdf", page: 2 }).ok).toBe(true);
  });
  it("scoped widgets validate their scope props", () => {
    expect(validateWidgetProps("timeline", { objectId: "o1" }).ok).toBe(true);
    expect(validateWidgetProps("edit-history", { objectId: "o1" }).ok).toBe(true);
    expect(validateWidgetProps("linked-resources", { kinds: ["pack", "nope"] }).ok).toBe(false);
    expect(validateWidgetProps("linked-resources", { kinds: ["pack", "doc"] }).ok).toBe(true);
    expect(validateWidgetProps("spreadsheet-display", { runId: "r1", showQuarantined: true }).ok).toBe(true);
    expect(validateWidgetProps("free-form-analysis", { maxLength: 50 }).ok).toBe(false);
  });
});

describe("board-level validation gate", () => {
  it("accepts a well-formed board for every role that can see it", () => {
    const board = [
      { type: "object-table", props: { typeKey: "shipment" } },
      { type: "map", props: {} },
    ];
    expect(validateWidgetBoard(board, "OWNER").ok).toBe(true);
    expect(validateWidgetBoard(board, "VIEWER").ok).toBe(true);
  });
  it("reports unknown types, bad props, and role violations with positions", () => {
    const out = validateWidgetBoard(
      [
        { type: "object-table", props: {} },
        { type: "teleport", props: {} },
        { type: "button-group", props: { actionKey: "mfg_resolve_delay" } },
      ],
      "VIEWER",
    );
    expect(out.ok).toBe(false);
    expect(out.problems.find((p) => p.index === 0)?.message).toMatch(/typeKey/);
    expect(out.problems.find((p) => p.index === 1)?.message).toMatch(/unknown widget/);
    expect(out.problems.find((p) => p.index === 2)?.message).toMatch(/not visible to VIEWER/);
  });
  it("rejects empty and oversized boards", () => {
    expect(validateWidgetBoard([]).ok).toBe(false);
    expect(validateWidgetBoard(Array.from({ length: 51 }, () => ({ type: "map", props: {} }))).ok).toBe(false);
    expect(validateWidgetBoard(Array.from({ length: 50 }, () => ({ type: "map", props: {} })), "VIEWER").ok).toBe(true);
  });
});
