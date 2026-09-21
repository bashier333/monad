import { describe, expect, it } from "vitest";
import {
  bfs,
  buildAdjacency,
  connectedComponents,
  degreeRank,
  shortestPath,
  suggestLinks,
} from "@/lib/core/ontology/graph";

const EDGES = [
  { fromId: "lane1", linkKey: "lane_loads", toId: "load1" },
  { fromId: "lane1", linkKey: "lane_loads", toId: "load2" },
  { fromId: "load1", linkKey: "load_truck", toId: "truck1" },
  { fromId: "load2", linkKey: "load_truck", toId: "truck1" },
  { fromId: "solo", linkKey: "lone", toId: "island" },
];

function adj() {
  const out = buildAdjacency(EDGES);
  const incoming = buildAdjacency(EDGES.map((e) => ({ ...e, fromId: e.toId, toId: e.fromId })));
  return { out, incoming };
}

describe("ontology graph (ONT-0216-0255)", () => {
  it("traverses out with depth cap", () => {
    const { out, incoming } = adj();
    const r1 = bfs(out, incoming, "lane1", { maxDepth: 1 });
    expect(r1.nodes.sort()).toEqual(["lane1", "load1", "load2"].sort());
    const r2 = bfs(out, incoming, "lane1", { maxDepth: 2 });
    expect(r2.nodes).toContain("truck1");
    expect(r2.truncated).toBe(false);
  });
  it("respects link filters and direction", () => {
    const { out, incoming } = adj();
    const r = bfs(out, incoming, "truck1", { direction: "in", maxDepth: 1 });
    expect(r.nodes).toContain("load1");
    expect(r.nodes).not.toContain("lane1");
    const f = bfs(out, incoming, "lane1", { linkKeys: ["load_truck"], maxDepth: 2 });
    expect(f.nodes).toEqual(["lane1"]);
  });
  it("truncates over the visit cap and survives cycles", () => {
    const cyclic = [...EDGES, { fromId: "truck1", linkKey: "loop", toId: "lane1" }];
    const out = buildAdjacency(cyclic);
    const incoming = buildAdjacency(cyclic.map((e) => ({ ...e, fromId: e.toId, toId: e.fromId })));
    const r = bfs(out, incoming, "lane1", { maxDepth: 4, visitCap: 3 });
    expect(r.truncated).toBe(true);
    expect(r.nodes.length).toBeLessThanOrEqual(5);
  });
  it("finds shortest paths", () => {
    const { out, incoming } = adj();
    expect(shortestPath(out, incoming, "lane1", "truck1")).toEqual(["lane1", "load1", "truck1"]);
    expect(shortestPath(out, incoming, "lane1", "island")).toBeNull();
    expect(shortestPath(out, incoming, "lane1", "lane1")).toEqual(["lane1"]);
  });
  it("computes components, ranks, and suggestions", () => {
    expect(connectedComponents(EDGES)).toHaveLength(2);
    const rank = degreeRank(EDGES, 2);
    expect(rank[0]!.degree).toBeGreaterThanOrEqual(rank[1]!.degree);
    const { out, incoming } = adj();
    const sug = suggestLinks(out, incoming, "load1");
    expect(sug[0]).toEqual({ objectId: "load2", sharedNeighbors: 2 });
  });
});
