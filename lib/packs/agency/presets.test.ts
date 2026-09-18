import { describe, expect, it } from "vitest";
import { applyHeaderPreset } from "@/lib/core/ingest/presets";
import { AGENCY_PRESETS } from "@/lib/packs/agency/presets";

describe("agency presets (X4 E-181–186)", () => {
  it("declares the 5 documented vendors", () => {
    expect(AGENCY_PRESETS.map((p) => p.vendor).sort()).toEqual(
      ["asana", "frameio", "generic-agency", "harvest", "quickbooks"],
    );
  });

  it("harvest preset maps a Harvest-style time export", () => {
    const m = applyHeaderPreset(
      ["Date", "Client", "Project", "Task", "Hours", "Person"],
      AGENCY_PRESETS.find((p) => p.vendor === "harvest")!.headers,
    );
    expect(m).toMatchObject({ date: 0, client: 1, project: 2, task: 3, hours: 4, person: 5 });
  });

  it("quickbooks preset maps an invoice export", () => {
    const m = applyHeaderPreset(
      ["Invoice #", "Customer", "Amount", "TxnDate"],
      AGENCY_PRESETS.find((p) => p.vendor === "quickbooks")!.headers,
    );
    expect(m).toMatchObject({ project: 1, amount: 2, date: 3 });
  });
});
