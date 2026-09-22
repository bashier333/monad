import { describe, expect, it } from "vitest";
import {
  checkCardinality,
  diffTypeSnapshots,
  planMigration,
  type TypeSnapshot,
} from "@/lib/core/ontology/versions";
import {
  AUTO_MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
  classifyMatch,
  normalizeKey,
  normalizeName,
  scoreMatch,
  stableObjectKey,
} from "@/lib/core/ontology/identity";
import {
  KEY_RE,
  isReservedKey,
  validateLinkInput,
  validateTypeInput,
} from "@/lib/core/ontology/schema";
import {
  TEMPLATES,
  buildTemplate,
  defineLink,
  defineType,
} from "@/lib/core/ontology/builder";
import {
  bfs,
  buildAdjacency,
  connectedComponents,
  degreeRank,
  shortestPath,
  suggestLinks,
  type AdjEdge,
} from "@/lib/core/ontology/graph";
import { searchObjects, type IndexedObject } from "@/lib/core/ontology/search-nl";
import { naturalKeyFor } from "@/lib/core/ontology/objects";

// Phase B-core + C-query pure-logic proof (F2-01001..F2-02000 topics that run
// without a database). DB-backed paths (registry writes, traverseLive,
// listObjects paging) are verified by code inspection + route contract tests;
// every pure rule below is executed.

const SNAP_A: TypeSnapshot = {
  key: "shipment",
  label: "Shipment",
  plural: "Shipments",
  description: "",
  properties: [
    { key: "status", label: "Status", kind: "string", required: true, unique: false, indexed: true, immutable: false },
    { key: "miles", label: "Miles", kind: "number", required: false, unique: false, indexed: false, immutable: false },
    { key: "old_field", label: "Old", kind: "string", required: false, unique: false, indexed: false, immutable: false },
  ],
};

const SNAP_B: TypeSnapshot = {
  ...SNAP_A,
  properties: [
    { key: "status", label: "Status", kind: "enum", required: true, unique: true, indexed: true, immutable: true, config: { options: ["a"] } },
    { key: "miles", label: "Miles", kind: "number", required: false, unique: false, indexed: false, immutable: false },
    { key: "eta", label: "ETA", kind: "datetime", required: false, unique: false, indexed: false, immutable: false },
  ],
};

describe("versions: diff + migration plan", () => {
  it("detects added/removed/changed incl. flags and config", () => {
    const d = diffTypeSnapshots(SNAP_A, SNAP_B);
    expect(d.added).toEqual(["eta"]);
    expect(d.removed).toEqual(["old_field"]);
    const status = d.changed.find((c) => c.key === "status")!;
    expect(status.fields).toEqual(expect.arrayContaining(["kind", "unique", "immutable", "config"]));
    expect(d.changed.find((c) => c.key === "miles")).toBeUndefined();
  });
  it("plans non-destructive adds, destructive kind-changes and drops", () => {
    const plan = planMigration(diffTypeSnapshots(SNAP_A, SNAP_B));
    expect(plan.find((s) => s.op === "add_property")?.destructive).toBe(false);
    expect(plan.find((s) => s.op === "alter_property")?.destructive).toBe(true);
    expect(plan.find((s) => s.op === "drop_property")?.destructive).toBe(true);
    expect(planMigration(diffTypeSnapshots(SNAP_A, SNAP_A))).toEqual([]);
  });
  it("enforces one-one cardinality, passes the rest", () => {
    expect(checkCardinality("one-one", 1).ok).toBe(false);
    expect(checkCardinality("one-one", 0).ok).toBe(true);
    expect(checkCardinality("one-many", 5).ok).toBe(true);
    expect(checkCardinality("many-many", 99).ok).toBe(true);
  });
});

describe("identity: keys, scoring, thresholds", () => {
  it("normalizes keys and names deterministically", () => {
    expect(normalizeKey(" Dallas TX ")).toBe(normalizeKey("dallas_tx"));
    expect(normalizeName("  ACME  Freight ")).toBe("acme freight");
    expect(stableObjectKey("t", "k")).toBe(stableObjectKey("t", "k"));
  });
  it("scores exact/near/none with reasons", () => {
    expect(scoreMatch("Acme", "Acme").score).toBe(1);
    expect(scoreMatch("Acme Freight", "Acme Freigh").score).toBeGreaterThan(0.5);
    expect(scoreMatch("apple", "truck").score).toBeLessThan(0.5);
  });
  it("classifies at the documented thresholds", () => {
    expect(AUTO_MERGE_THRESHOLD).toBe(0.92);
    expect(REVIEW_THRESHOLD).toBe(0.7);
    expect(classifyMatch(0.95)).toBe("auto");
    expect(classifyMatch(0.8)).toBe("review");
    expect(classifyMatch(0.2)).toBe("no-match");
  });
  it("derives a natural key from the first string field", () => {
    expect(naturalKeyFor("t", { a: "", b: "hello" })).toContain("hello");
  });
});

describe("schema: keys, reserved, limits", () => {
  it("enforces snake_case 2-64", () => {
    expect(KEY_RE.test("dallas_tx")).toBe(true);
    expect(KEY_RE.test("Dallas")).toBe(false);
    expect(KEY_RE.test("x")).toBe(false);
    expect(isReservedKey("type")).toBe(true);
    expect(isReservedKey("TYPE")).toBe(true);
    expect(isReservedKey("warehouse")).toBe(false);
  });
  it("rejects reserved/duplicate props and 200+ property sets", () => {
    const base = { key: "t", label: "T", properties: [{ key: "type", label: "Type", kind: "string" as const }] };
    expect(validateTypeInput(base).ok).toBe(false);
    const dup = {
      key: "t",
      label: "T",
      properties: [
        { key: "a", label: "A", kind: "string" as const },
        { key: "a", label: "A2", kind: "string" as const },
      ],
    };
    expect(validateTypeInput(dup).ok).toBe(false);
    const many = {
      key: "t",
      label: "T",
      properties: Array.from({ length: 201 }, (_, i) => ({ key: `p${i}`, label: `P${i}`, kind: "string" as const })),
    };
    const over = validateTypeInput(many);
    expect(over.ok).toBe(false);
  });
  it("rejects links to unknown types and bad cardinality", () => {
    expect(validateLinkInput({ key: "ln", fromTypeKey: "aa", toTypeKey: "nope", cardinality: "one-many" }, new Set(["aa"])).ok).toBe(false);
    expect(validateLinkInput({ key: "ln", fromTypeKey: "aa", toTypeKey: "aa", cardinality: "sideways" }, new Set(["aa"])).ok).toBe(false);
    expect(validateLinkInput({ key: "ln", fromTypeKey: "aa", toTypeKey: "aa", cardinality: "one-many" }, new Set(["aa"])).ok).toBe(true);
    expect(validateLinkInput({ key: "type", fromTypeKey: "aa", toTypeKey: "aa", cardinality: "one-many" }, new Set(["aa"])).ok).toBe(false);
  });
});

describe("builder: types, links, templates", () => {
  it("defines valid types and rejects bad ones by throwing", () => {
    expect(defineType({ key: "wd", label: "W", properties: [{ key: "nm", kind: "string" }] }).key).toBe("wd");
    expect(() => defineType({ key: "Bad Key!", label: "B", properties: [] })).toThrow();
    expect(defineLink({ key: "ln", from: "aa", to: "bb", cardinality: "many-many" }, ["aa", "bb"]).cardinality).toBe("many-many");
    expect(() => defineLink({ key: "ln", from: "aa", to: "ghost", cardinality: "one-many" }, ["aa"])).toThrow();
  });
  it("every shipped template builds cleanly (custom-template path included)", () => {
    for (const name of Object.keys(TEMPLATES)) {
      const built = buildTemplate(name);
      expect(built.length).toBeGreaterThan(0);
      for (const t of built) expect(t.key).toMatch(KEY_RE);
    }
    expect(Object.keys(TEMPLATES)).toEqual(expect.arrayContaining(["crm", "inventory", "fleet", "projects"]));
    expect(() => buildTemplate("nope")).toThrow(/unknown template/);
    // Custom template: any caller-composed type validates through the same gate.
    expect(defineType({ key: "custom_widget", label: "Custom", properties: [{ key: "title", kind: "string", required: true }] }).properties).toHaveLength(1);
  });
});

const EDGES: AdjEdge[] = [
  { fromId: "a", linkKey: "supplies", toId: "b" },
  { fromId: "b", linkKey: "supplies", toId: "c" },
  { fromId: "c", linkKey: "supplies", toId: "d" },
  { fromId: "d", linkKey: "supplies", toId: "e" },
  { fromId: "e", linkKey: "supplies", toId: "f" },
  { fromId: "a", linkKey: "owns", toId: "z" },
];

describe("graph: bfs caps, directions, filters", () => {
  it("caps depth at 4 even when asked for more", () => {
    const out = buildAdjacency(EDGES);
    const incoming = buildAdjacency([]);
    const deep = bfs(out, incoming, "a", { maxDepth: 99 });
    expect(deep.nodes).not.toContain("f");
    expect(deep.nodes).toContain("e");
  });
  it("flags truncation past the visit cap", () => {
    const out = buildAdjacency(EDGES);
    const r = bfs(out, buildAdjacency([]), "a", { maxDepth: 4, visitCap: 1 });
    expect(r.truncated).toBe(true);
    const full = bfs(out, buildAdjacency([]), "a", { maxDepth: 4 });
    expect(full.truncated).toBe(false);
  });
  it("walks in/both directions and filters link keys", () => {
    const out = buildAdjacency(EDGES);
    const incoming = buildAdjacency(EDGES.map((e) => ({ fromId: e.toId, linkKey: e.linkKey, toId: e.fromId })));
    expect(bfs(out, incoming, "c", { direction: "in", maxDepth: 1 }).nodes).toContain("b");
    expect(bfs(out, incoming, "c", { direction: "both", maxDepth: 1 }).nodes).toEqual(
      expect.arrayContaining(["b", "d"]),
    );
    const filtered = bfs(out, incoming, "a", { maxDepth: 1, linkKeys: ["owns"] });
    expect(filtered.nodes).toEqual(expect.arrayContaining(["a", "z"]));
    expect(filtered.nodes).not.toContain("b");
  });
  it("finds shortest paths, components, suggestions and ranks", () => {
    const out = buildAdjacency(EDGES);
    const incoming = buildAdjacency([]);
    expect(shortestPath(out, incoming, "a", "c")).toEqual(["a", "b", "c"]);
    expect(shortestPath(out, incoming, "c", "a")).toBeNull();
    const comps = connectedComponents([...EDGES, { fromId: "lonely", linkKey: "x", toId: "lonely2" }]);
    expect(comps.length).toBeGreaterThanOrEqual(2);
    expect(suggestLinks(out, incoming, "a", 5).length).toBeLessThanOrEqual(5);
    const rank = degreeRank(EDGES, 3);
    expect(rank).toHaveLength(3);
    expect(rank[0]!.degree).toBeGreaterThanOrEqual(rank[2]!.degree);
  });
});

describe("search: key/text/fuzzy with guards", () => {
  const index: IndexedObject[] = [
    { id: "1", typeKey: "shipment", key: "sh-100", text: "dallas houstonlane" },
    { id: "2", typeKey: "plant", key: "pl-9", text: "houston assembly" },
  ];
  it("matches key first, then text, then fuzzy; rejects short queries", () => {
    expect(searchObjects(index, "sh-100")[0]).toMatchObject({ id: "1", matched: "key" });
    expect(searchObjects(index, "assembly").some((h) => h.id === "2")).toBe(true);
    expect(searchObjects(index, "x")).toEqual([]);
  });
  it("filters by type and clamps limits", () => {
    expect(searchObjects(index, "houston", { typeKey: "plant" }).every((h) => h.typeKey === "plant")).toBe(true);
    expect(searchObjects(index, "houston", { limit: 1 })).toHaveLength(1);
  });
});
