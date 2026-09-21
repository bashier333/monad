import { describe, expect, it } from "vitest";
import { explainPlan, indexText, planQuery, searchObjects } from "@/lib/core/ontology/search-nl";

const INDEX = [
  { id: "1", typeKey: "lane", key: "dallas_tx_houston_tx", text: "Dallas Houston" },
  { id: "2", typeKey: "lane", key: "phoenix_az_el_paso_tx", text: "Phoenix El Paso" },
  { id: "3", typeKey: "driver", key: "mike_r", text: "Mike Richards" },
];

const TYPES = [
  { key: "lane", label: "Lane", plural: "lanes", measures: ["margin", "revenue"], entityWord: "lane" },
  { key: "project", label: "Project", plural: "projects", measures: ["margin"], entityWord: "project" },
];

describe("ontology search (ONT-0601-0620)", () => {
  it("indexes text from nested data", () => {
    expect(indexText({ a: "hi", b: { c: 5, d: ["x", ""] } })).toBe("hi 5 x");
  });
  it("finds exact keys first", () => {
    const hits = searchObjects(INDEX, "dallas_tx_houston_tx");
    expect(hits[0]).toMatchObject({ id: "1", score: 100 });
  });
  it("matches typos and scopes by type", () => {
    expect(searchObjects(INDEX, "dalls").length).toBeGreaterThan(0);
    expect(searchObjects(INDEX, "mike", { typeKey: "lane" })).toHaveLength(0);
    expect(searchObjects(INDEX, "mike", { typeKey: "driver" })).toHaveLength(1);
    expect(searchObjects(INDEX, "x")).toHaveLength(0);
  });
});

describe("ontology NL planning (ONT-0621-0645)", () => {
  it("plans a ranked question", () => {
    const plan = planQuery("worst 5 lanes last week by margin", TYPES);
    expect(plan).toMatchObject({ typeKey: "lane", measure: "margin", direction: "bottom", limit: 5, timeRange: "last_week" });
    expect(plan.unresolved).toHaveLength(0);
  });
  it("asks for clarity when vague", () => {
    const plan = planQuery("show me the worst", TYPES);
    expect(plan.typeKey).toBeNull();
    expect(plan.unresolved.length).toBeGreaterThan(0);
    expect(explainPlan(plan)).toMatch(/clarity/);
  });
  it("explains resolved plans", () => {
    const plan = planQuery("best lanes by margin", TYPES);
    expect(plan.direction).toBe("top");
    expect(plan.unresolved).toHaveLength(0);
    expect(explainPlan(plan)).toMatch(/type=lane/);
  });
});
