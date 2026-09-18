import { correctionFromRow, expandRule } from "@/lib/corrections/rules";
import { describe, expect, it } from "vitest";

const LOADS = [
  { loadKey: "A", driver: "Deshawn", origin: "DALLAS TX", destination: "HOUSTON TX", broker: "BlueLine", truck: "Unit12", lane: "DALLAS TX → HOUSTON TX", date: "2026-09-07", revenue: "1850", miles: "242" },
  { loadKey: "B", driver: "Vera", origin: "AUSTIN TX", destination: "DALLAS TX", broker: "BlueLine", truck: "Unit3", lane: "AUSTIN TX → DALLAS TX", date: "2026-09-12", revenue: "900", miles: "195" },
];

describe("standing rule expansion", () => {
  it("expands a driver-matched reattribute rule to the right loads", () => {
    const out = expandRule(
      { id: "r1", kind: "reattribute", costKind: "detention", matchField: "driver", matchValue: "deshawn", toLoad: null, reason: "shipper fault" },
      LOADS,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ fromLoad: "A", toLoad: null, costKind: "detention" });
  });

  it("matches case-insensitively and ignores blanks", () => {
    const out = expandRule(
      { id: "r2", kind: "reattribute", costKind: "fee", matchField: "broker", matchValue: "BLUELINE", toLoad: "A", reason: "x" },
      LOADS,
    );
    expect(out).toHaveLength(2);
  });

  it("rejects unknown kinds and empty matchers", () => {
    expect(
      expandRule({ id: "r3", kind: "nope", costKind: "fee", matchField: "driver", matchValue: "x", toLoad: null, reason: "" }, LOADS),
    ).toEqual([]);
    expect(
      expandRule({ id: "r4", kind: "reattribute", costKind: "fee", matchField: "driver", matchValue: "", toLoad: null, reason: "" }, LOADS),
    ).toEqual([]);
  });

  it("maps a correction row to an engine correction", () => {
    expect(
      correctionFromRow({ id: "c1", field: "detention", targetKey: "B", newValue: "EXCLUDE", reason: "shipper" }),
    ).toMatchObject({ id: "corr:c1", costKind: "detention", fromLoad: "B", toLoad: null });
  });

  it("matches lanes, date ranges, and numeric thresholds", () => {
    const lane = expandRule(
      { id: "r5", kind: "reattribute", costKind: "fee", matchField: "lane", matchValue: "dallas tx → houston tx", toLoad: null, reason: "" },
      LOADS,
    );
    expect(lane.map((c) => c.fromLoad)).toEqual(["A"]);
    const dated = expandRule(
      { id: "r6", kind: "reattribute", costKind: "fee", matchField: "date", matchValue: ">=2026-09-10", toLoad: null, reason: "" },
      LOADS,
    );
    expect(dated.map((c) => c.fromLoad)).toEqual(["B"]);
    const rich = expandRule(
      { id: "r7", kind: "reattribute", costKind: "fee", matchField: "revenue", matchValue: ">1000", toLoad: null, reason: "" },
      LOADS,
    );
    expect(rich.map((c) => c.fromLoad)).toEqual(["A"]);
  });
});
