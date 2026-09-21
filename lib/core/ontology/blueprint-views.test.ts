import { describe, expect, it } from "vitest";
import { toLinkML, toShacl, type PackView } from "@/lib/core/ontology/blueprint-views";

const PACK: PackView = {
  exportedAt: "2026-09-20T00:00:00.000Z",
  types: [
    {
      key: "mfg_plant",
      label: "Plant",
      description: "A factory.",
      properties: [
        { key: "name", label: "Name", kind: "string", required: true, unique: false },
        { key: "status", label: "Status", kind: "enum", required: false, unique: false, config: { options: ["active", "idle"] } },
        { key: "qty", label: "Qty", kind: "integer", required: true, unique: false },
        { key: "loc", label: "Location", kind: "geo", required: false, unique: false },
        { key: "calc", label: "Calc", kind: "computed", required: false, unique: false },
      ],
    },
  ],
  links: [{ key: "mfg_supplies", fromTypeKey: "mfg_warehouse", toTypeKey: "mfg_plant", cardinality: "many-many", inverseKey: "mfg_supplied_by" }],
};

describe("blueprint views (MFG-0801)", () => {
  it("renders LinkML with kinds preserved as annotations", () => {
    const yml = toLinkML(PACK);
    expect(yml).toContain("name: monad-ontology-pack");
    expect(yml).toContain("mfg_plant:");
    expect(yml).toContain("required: true");
    expect(yml).toContain("x-monad-kind: \"integer\"");
    expect(yml).toContain("x-monad-computed-readonly: true");
    expect(yml).toContain("permissible_values:");
    expect(yml).toContain("multivalued: true");
    expect(yml).toContain("mfg_supplies:");
    expect(yml).toContain("Lossy by design");
  });
  it("renders SHACL with closed shapes and datatypes", () => {
    const doc = toShacl(PACK) as { "@graph": Array<Record<string, unknown>> };
    const shape = doc["@graph"].find((s) => s["@id"] === "monad:mfg_plantShape")!;
    expect(shape["sh:closed"]).toBe(true);
    const props = shape["sh:property"] as Array<Record<string, unknown>>;
    const name = props.find((p) => p["sh:path"] === "monad:name")!;
    expect(name["sh:minCount"]).toBe(1);
    expect(name["sh:datatype"]).toContain("XMLSchema#string");
    const qty = props.find((p) => p["sh:path"] === "monad:qty")!;
    expect(qty["sh:datatype"]).toContain("XMLSchema#integer");
    const status = props.find((p) => p["sh:path"] === "monad:status")!;
    expect(status["sh:in"]).toEqual(["active", "idle"]);
    const geo = props.find((p) => p["sh:path"] === "monad:loc")!;
    expect(geo["sh:node"]).toBe("monad:GeoPointShape");
    expect(geo["sh:datatype"]).toBeUndefined();
    const link = doc["@graph"].find((s) => s["@id"] === "monad:mfg_suppliesLink")!;
    expect(link["x-monad-cardinality"]).toBe("many-many");
    expect(link["sh:maxCount"]).toBeUndefined();
  });
});
