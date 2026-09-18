import { applyPreset, PRESETS } from "@/lib/ingest/presets";
import { describe, expect, it } from "vitest";

describe("vendor presets (W4)", () => {
  it("covers 5 vendors", () => {
    expect(PRESETS.map((p) => p.vendor).sort()).toEqual(["ascend", "generic", "mcleod", "prophesy", "tmw"]);
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

  it("leaves unknown headers unmapped", () => {
    const m = applyPreset(["Foo", "Bar"], PRESETS[0]);
    expect(m).toEqual({});
  });
});
