import { describe, expect, it } from "vitest";
import { colorForType, toGraphData, toMapPoints, traceConnections } from "@/lib/packs/manufacturing/graph-view";
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
