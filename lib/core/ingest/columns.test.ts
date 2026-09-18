import { detectColumns } from "@/lib/core/ingest/columns";
import { describe, expect, it } from "vitest";

const TMS_HEADERS = [
  "LoadID",
  "PickupDate",
  "Origin",
  "Destination",
  "Driver",
  "Truck",
  "Revenue",
  "Miles",
  "Broker",
  "Detention",
];

describe("detectColumns", () => {
  it("maps a standard TMS export with high confidence", () => {
    const { mapping, confidence, unmapped } = detectColumns(TMS_HEADERS);
    expect(mapping.loadId).toBe(0);
    expect(mapping.date).toBe(1);
    expect(mapping.origin).toBe(2);
    expect(mapping.destination).toBe(3);
    expect(mapping.revenue).toBe(6);
    expect(mapping.miles).toBe(7);
    expect(unmapped).toEqual([]);
    for (const c of Object.values(confidence)) {
      expect(c).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("leaves unknown headers unmapped without claiming fields twice", () => {
    const { mapping, unmapped } = detectColumns(["LoadID", "Foo123", "Revenue"]);
    expect(mapping.loadId).toBe(0);
    expect(mapping.revenue).toBe(2);
    expect(unmapped).toEqual([1]);
  });

  it("matches terse headers like Dest and Unit", () => {
    const { mapping } = detectColumns(["Dest", "Unit", "Rate"]);
    expect(mapping.destination).toBe(0);
    expect(mapping.truck).toBe(1);
    expect(mapping.revenue).toBe(2);
  });
});
