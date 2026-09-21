import { describe, expect, it } from "vitest";
import { validateActionDef } from "@/lib/core/ontology/actions";
import { canExecuteVerb, MANUFACTURING_ACTIONS, TRANSFER_QUORUM_THRESHOLD, validateVerbInputs } from "@/lib/packs/manufacturing/actions";

describe("manufacturing action definitions (MFG-0301)", () => {
  it("has six governed verbs", () => {
    expect(MANUFACTURING_ACTIONS).toHaveLength(6);
    expect(MANUFACTURING_ACTIONS.map((a) => a.key)).toEqual([
      "mfg_transfer_stock",
      "mfg_create_shipment",
      "mfg_reroute_shipment",
      "mfg_record_production",
      "mfg_resolve_delay",
      "mfg_adjust_safety_stock",
    ]);
  });

  it("every definition validates against the engine schema", () => {
    for (const spec of MANUFACTURING_ACTIONS) {
      const res = validateActionDef(spec);
      expect(res.ok, `${spec.key}: ${res.ok ? "" : JSON.stringify(res.problems)}`).toBe(true);
    }
  });

  it("every $inputs reference maps to a documented input", () => {
    for (const spec of MANUFACTURING_ACTIONS) {
      const documented = Object.keys(spec.inputs);
      const refs = new Set<string>();
      for (const e of spec.effects) {
        const scan = (v: unknown) => {
          if (typeof v === "string" && v.startsWith("$inputs.")) refs.add(v.slice(8));
          else if (v && typeof v === "object" && !Array.isArray(v) && "$input" in (v as Record<string, unknown>)) {
            refs.add(String((v as Record<string, unknown>)["$input"]));
          } else if (Array.isArray(v)) v.forEach(scan);
          else if (v && typeof v === "object") Object.values(v).forEach(scan);
        };
        scan(e.value);
        scan(e.targetId);
        scan(e.data);
      }
      for (const ref of refs) {
        expect(documented, `${spec.key} references $inputs.${ref}`).toContain(ref);
      }
    }
  });

  it("governed verbs require approval", () => {
    const transfer = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_transfer_stock")!;
    expect(transfer.approvalPolicy).toBe("single");
    const reroute = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_reroute_shipment")!;
    expect(reroute.approvalPolicy).toBe("single");
    const production = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_record_production")!;
    expect(production.approvalPolicy).toBe("none");
  });
});

describe("manufacturing verb input validation (MFG-0302)", () => {
  it("transfer_stock requires a destination and positive qty", () => {
    expect(validateVerbInputs("mfg_transfer_stock", { toLotId: "lot-b", qty: 10 }).ok).toBe(true);
    expect(validateVerbInputs("mfg_transfer_stock", { toLotId: "lot-b", qty: 0 }).ok).toBe(false);
    expect(validateVerbInputs("mfg_transfer_stock", { qty: 10 }).ok).toBe(false);
  });

  it("create_shipment requires shipmentId and qty", () => {
    expect(validateVerbInputs("mfg_create_shipment", { shipmentId: "SH-1", qty: 5 }).ok).toBe(true);
    expect(validateVerbInputs("mfg_create_shipment", { qty: 5 }).ok).toBe(false);
  });

  it("reroute_shipment needs at least one field", () => {
    expect(validateVerbInputs("mfg_reroute_shipment", { eta: "2026-10-01T08:00:00Z" }).ok).toBe(true);
    expect(validateVerbInputs("mfg_reroute_shipment", {}).ok).toBe(false);
  });

  it("resolve_delay restricts status values", () => {
    expect(validateVerbInputs("mfg_resolve_delay", { status: "delivered" }).ok).toBe(true);
    expect(validateVerbInputs("mfg_resolve_delay", { status: "delayed" }).ok).toBe(false);
  });

  it("unknown verbs are rejected", () => {
    expect(validateVerbInputs("mfg_nope", {}).ok).toBe(false);
  });
});

describe("transfer quorum threshold (MFG-0303)", () => {
  it("is 500 units", () => {
    expect(TRANSFER_QUORUM_THRESHOLD).toBe(500);
  });
});

describe("per-verb roles and latitude (MFG-0304)", () => {
  it("owners pass every verb", () => {
    for (const spec of MANUFACTURING_ACTIONS) {
      expect(canExecuteVerb("OWNER", spec)).toBe(true);
    }
  });

  it("dispatchers pass only listed verbs", () => {
    const transfer = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_transfer_stock")!;
    const production = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_record_production")!;
    const adjust = MANUFACTURING_ACTIONS.find((a) => a.key === "mfg_adjust_safety_stock")!;
    expect(canExecuteVerb("DISPATCHER", transfer)).toBe(false);
    expect(canExecuteVerb("DISPATCHER", production)).toBe(true);
    expect(canExecuteVerb("DISPATCHER", adjust)).toBe(true);
    expect(canExecuteVerb("VIEWER", production)).toBe(false);
  });

  it("every verb declares roles and a latitude tier", () => {
    for (const spec of MANUFACTURING_ACTIONS) {
      expect(spec.allowedRoles.length).toBeGreaterThan(0);
      expect(["auto", "confirm", "never"]).toContain(spec.latitude);
    }
  });

  it("write-back verbs require confirmation latitude", () => {
    const confirmVerbs = ["mfg_transfer_stock", "mfg_create_shipment", "mfg_reroute_shipment", "mfg_resolve_delay"];
    for (const key of confirmVerbs) {
      expect(MANUFACTURING_ACTIONS.find((a) => a.key === key)!.latitude).toBe("confirm");
    }
  });
});
