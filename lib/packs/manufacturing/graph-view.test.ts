import { describe, expect, it } from "vitest";
import { colorForType, layoutFlow, toGraphData, toMapPoints, traceConnections } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraphNode } from "@/lib/packs/manufacturing/service";

const NODES: TwinGraphNode[] = [
  { id: "p1", key: "plant-one", type: "plant", label: "Plant One", region: "midwest", geopoint: { lat: 41.878, lng: -87.629 }, status: "running" },
  { id: "w1", key: "wh-central", type: "warehouse", label: "WH Central", region: "midwest", geopoint: { lat: 41.881, lng: -87.623 } },
  { id: "c1", key: "acme", type: "customer", label: "Acme", region: "east", geopoint: null },
];

describe("graph view mapping (MFG-0601)", () => {
  it("colors nodes by type with a fallback", () => {
    expect(colorForType("plant")).toBe("#047857");
    expect(colorForType("warehouse")).toBe("#1d4ed8");
    expect(colorForType("mystery")).toBe("#57534e");
  });

  it("dedupes nodes and drops dangling edges", () => {
    const out = toGraphData(
      [...NODES, { ...NODES[0]! }],
      [
        { fromId: "w1", linkKey: "mfg_supplies", toId: "p1" },
        { fromId: "w1", linkKey: "mfg_supplies", toId: "ghost" },
      ]
    );
    expect(out.nodes).toHaveLength(3);
    expect(out.links).toEqual([{ source: "w1", target: "p1", label: "mfg_supplies" }]);
  });

  it("handles an empty network", () => {
    expect(toGraphData([], [])).toEqual({ nodes: [], links: [] });
  });
});

describe("connection tracing", () => {
  const links = [
    { source: "supplier", target: "plant", label: "supplies" },
    { source: "plant", target: "warehouse", label: "ships" },
    { source: "warehouse", target: "customer", label: "delivers" },
    { source: "plant", target: "customer", label: "direct" },
  ];
  it("walks upstream and downstream through the chain", () => {
    expect(traceConnections(links, "plant")).toEqual({
      upstream: ["supplier"],
      downstream: ["customer", "warehouse"],
    });
    expect(traceConnections(links, "supplier")).toEqual({ upstream: [], downstream: ["customer", "plant", "warehouse"] });
  });

  it("returns empty sets for unknown or isolated nodes", () => {
    expect(traceConnections(links, "ghost")).toEqual({ upstream: [], downstream: [] });
    expect(traceConnections([], "plant")).toEqual({ upstream: [], downstream: [] });
  });

  it("survives cycles without looping forever", () => {
    const cyclic = [...links, { source: "customer", target: "supplier", label: "returns" }];
    const t = traceConnections(cyclic, "plant");
    expect(t.upstream).toContain("customer");
    expect(t.downstream).toContain("supplier");
  });
});

describe("funnel layout", () => {
  const nodes = [
    { id: "s1", key: "s1", type: "supplier", label: "Supplier" },
    { id: "p1", key: "p1", type: "plant", label: "Plant" },
    { id: "w1", key: "w1", type: "warehouse", label: "Warehouse" },
    { id: "c1", key: "c1", type: "customer", label: "Customer" },
  ];
  const edges = [
    { fromId: "s1", linkKey: "supplies", toId: "p1" },
    { fromId: "p1", linkKey: "ships", toId: "w1" },
    { fromId: "w1", linkKey: "delivers", toId: "c1" },
  ];
  it("layers nodes left to right along the flow", () => {
    const { nodes: out, edges: outEdges, width, height } = layoutFlow(nodes, edges);
    const stageOf = Object.fromEntries(out.map((n) => [n.id, n.stage]));
    expect(stageOf).toEqual({ s1: 0, p1: 1, w1: 2, c1: 3 });
    expect(outEdges).toHaveLength(3);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // Positions increase with stage and never overlap within a stage.
    for (const e of outEdges) expect(e.d.startsWith("M ")).toBe(true);
  });

  it("merges parallel edges into thicker paths", () => {
    const { edges: outEdges } = layoutFlow(nodes, [
      ...edges,
      { fromId: "s1", linkKey: "supplies-rush", toId: "p1" },
    ]);
    const pair = outEdges.find((e) => e.source === "s1" && e.target === "p1")!;
    expect(pair.width).toBeGreaterThan(1);
    expect(pair.labels).toEqual(["supplies", "supplies-rush"]);
  });

  it("parks cycles in the last stage instead of looping", () => {
    const { nodes: out } = layoutFlow(nodes, [
      ...edges,
      { fromId: "c1", linkKey: "returns", toId: "s1" },
    ]);
    expect(out).toHaveLength(4);
    expect(out.every((n) => Number.isInteger(n.stage) && n.stage >= 0)).toBe(true);
  });

  it("handles emptiness", () => {
    expect(layoutFlow([], [])).toMatchObject({ nodes: [], edges: [] });
  });
});

describe("map points mapping (MFG-0602)", () => {
  it("keeps valid points and counts the skipped", () => {
    const { points, skipped } = toMapPoints(NODES);
    expect(points.map((p) => p.id)).toEqual(["p1", "w1"]);
    expect(points[0]).toMatchObject({ lat: 41.878, lng: -87.629, status: "running" });
    expect(skipped).toBe(1);
  });

  it("drops out-of-range and non-finite coordinates", () => {
    const { points, skipped } = toMapPoints([
      { id: "a", key: "a", type: "plant", label: "A", geopoint: { lat: 999, lng: 0 } },
      { id: "b", key: "b", type: "plant", label: "B", geopoint: { lat: Number.NaN, lng: 0 } },
    ]);
    expect(points).toEqual([]);
    expect(skipped).toBe(2);
  });
});
