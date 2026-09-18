import { applyPreset, PRESETS } from "@/lib/core/ingest/presets";
import { describe, expect, it } from "vitest";

describe("vendor presets (W4)", () => {
  it("covers 10 vendors including agency tools", () => {
    expect(PRESETS.map((p) => p.vendor).sort()).toEqual([
      "asana",
      "ascend",
      "frameio",
      "generic",
      "generic-agency",
      "harvest",
      "mcleod",
      "prophesy",
      "quickbooks",
      "tmw",
    ]);
  });

  it("maps McLeod-style headers", () => {
    const m = applyPreset(
      ["Order ID", "Pickup Date", "Origin City", "Dest City", "Linehaul", "Loaded Miles", "Driver ID"],
      PRESETS.find((p) => p.vendor === "mcleod")!,
    );
    expect(m).toMatchObject({ loadId: 0, date: 1, origin: 2, destination: 3, revenue: 4, miles: 5, driver: 6 });
  });

  it("maps TMW-style headers case-insensitively", () => {
    const m = applyPreset(
      ["order number", "requested pickup", "shipper city", "consignee city", "billed amount", "paid miles", "customer"],
      PRESETS.find((p) => p.vendor === "tmw")!,
    );
    expect(m).toMatchObject({ loadId: 0, date: 1, origin: 2, destination: 3, revenue: 4, miles: 5, broker: 6 });
  });

  it("maps harvest-style time headers", () => {
    const m = applyPreset(
      ["Date", "Person", "Project", "Notes"],
      PRESETS.find((p) => p.vendor === "harvest")!,
    );
    expect(m).toMatchObject({ date: 0, driver: 1, truck: 2, detention: 3 });
  });

  it("leaves unknown headers unmapped", () => {
    const m = applyPreset(["Foo", "Bar"], PRESETS[0]);
    expect(m).toEqual({});
  });
});
