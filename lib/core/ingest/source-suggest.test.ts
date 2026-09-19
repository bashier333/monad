import { describe, expect, it } from "vitest";
import { resolveSourceType, suggestSourceType } from "@/lib/core/ingest/source-suggest";

describe("file-pattern routing (R-343)", () => {
  it("maps filenames to source types", () => {
    expect(suggestSourceType("fuel-week.csv")).toBe("fuel");
    expect(suggestSourceType("Harvest_Export_2026.csv")).toBe("time");
    expect(suggestSourceType("frameio-reviews.xlsx")).toBe("revision");
    expect(suggestSourceType("QuickBooks Invoices.csv")).toBe("invoice");
    expect(suggestSourceType("asana-tasks.csv")).toBe("project");
    expect(suggestSourceType("broker-statement.csv")).toBe("broker");
    expect(suggestSourceType("random.csv")).toBeNull();
  });

  it("auto falls back to tms; explicit choice wins", () => {
    expect(resolveSourceType("fuel.csv", "auto")).toBe("fuel");
    expect(resolveSourceType("random.csv", "auto")).toBe("tms");
    expect(resolveSourceType("fuel.csv", "broker")).toBe("broker");
  });
});
