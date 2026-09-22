import { describe, expect, it } from "vitest";
import {
  connectorLabel,
  normalizeFieldKey,
} from "./ontology-bridge";
import { connectorTypeKey } from "./connector";

describe("foundry -> ontology bridge (pure mapping)", () => {
  it("normalizes raw headers to valid ontology property keys", () => {
    expect(normalizeFieldKey("LoadID", 0)).toBe("loadid");
    expect(normalizeFieldKey("Pickup Date", 1)).toBe("pickup_date");
    expect(normalizeFieldKey("a", 2)).toBe("col_a");
    expect(normalizeFieldKey("!!!", 3)).toBe("col_3");
    expect(normalizeFieldKey("Revenue ($)", 4)).toBe("revenue");
  });

  it("maps every connector to a landing type + label", () => {
    expect(connectorTypeKey("csv-upload")).toBe("conn_csv_upload");
    expect(connectorLabel("csv-upload")).toBe("CSV upload");
    expect(connectorLabel("manual-form")).toBe("Manual form entries");
    expect(connectorTypeKey("eld-pings")).toBe("conn_eld_pings");
  });
});
