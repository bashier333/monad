import { describe, expect, it } from "vitest";
import { buildTemplate, defineLink, defineType } from "@/lib/core/ontology/builder";

describe("ontology builder (ONT-0086-0095)", () => {
  it("builds a valid type", () => {
    const t = defineType({ key: "lane", label: "Lane", properties: [{ key: "origin", kind: "string", required: true }] });
    expect(t.key).toBe("lane");
    expect(t.plural).toBe("Lanes");
  });
  it("throws on invalid type", () => {
    expect(() => defineType({ key: "Bad!", label: "x", properties: [] })).toThrow();
  });
  it("builds links against known types", () => {
    const l = defineLink({ key: "lane_loads", from: "lane", to: "load", cardinality: "one-many" }, ["lane", "load"]);
    expect(l.cardinality).toBe("one-many");
    expect(() => defineLink({ key: "x", from: "lane", to: "ghost", cardinality: "one-many" }, ["lane"])).toThrow();
  });
  it("builds all four templates", () => {
    for (const name of ["crm", "inventory", "fleet", "projects"]) {
      const types = buildTemplate(name);
      expect(types.length).toBe(3);
    }
    expect(() => buildTemplate("nope")).toThrow();
  });
});
