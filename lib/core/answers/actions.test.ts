import { describe, expect, it } from "vitest";
import { describeAction, parseAction, validateActionParams } from "@/lib/core/answers/actions";

const FLAG_CASES: Array<[string, string, number]> = [
  ["flag all detention over $50", "detention", 50],
  ["flag all detention over 50", "detention", 50],
  ["exclude fees over 200", "fee", 200],
  ["exclude all fuel over $75", "fuel", 75],
  ["flag fuel over $100", "fuel", 100],
  ["flag labor over 300", "labor", 300],
  ["exclude labor over $1,000", "labor", 1000],
  ["flag everything over 25", "labor", 25],
  ["exclude detention over $10.50", "detention", 10.5],
  ["flag all fees over 1000", "fee", 1000],
  ["exclude all fuel over 150", "fuel", 150],
  ["flag detention over $5", "detention", 5],
  ["exclude labor over 99", "labor", 99],
  ["flag all fuel over $20", "fuel", 20],
  ["exclude fees over $300", "fee", 300],
  ["flag labor over $450", "labor", 450],
];

const ALERT_CASES: Array<[string, string | undefined]> = [
  ["notify me when lane dallas houston drops", "dallas houston"],
  ["alert me when lane X drops below 100", "x"],
  ["watch my lanes", undefined],
  ["notify when project acme drops", "acme"],
  ["alert me when lane phoenix el paso falls", "phoenix el paso"],
  ["watch project beta logo drops", "beta logo"],
  ["notify when lane denver late", "denver"],
  ["alert when my lanes drop", undefined],
];

const RERUN_CASES = [
  "re-run with my rule",
  "rerun this week",
  "re run with corrections",
  "run again with my rules",
  "rerun the week",
  "run with my rule",
];

const EXPORT_CASES = [
  "export this view",
  "export the week",
  "export csv",
  "export answers",
  "export this page",
  "export the brief",
  "export corrections",
  "export lanes",
];

const INVITE_CASES: Array<[string, string | undefined, string | undefined]> = [
  ["invite ana@acme.test as dispatcher", "ana@acme.test", "DISPATCHER"],
  ["invite bob@acme.test as viewer", "bob@acme.test", "VIEWER"],
  ["invite cara@acme.test as owner", "cara@acme.test", "OWNER"],
  ["invite dan@acme.test", "dan@acme.test", undefined],
  ["invite eve", undefined, undefined],
  ["invite frank@acme.test as dispatcher", "frank@acme.test", "DISPATCHER"],
  ["please invite grace@acme.test as viewer", "grace@acme.test", "VIEWER"],
  ["invite hank@acme.test as owner", "hank@acme.test", "OWNER"],
  ["invite ivy@acme.test", "ivy@acme.test", undefined],
  ["add jack@acme.test as dispatcher", "jack@acme.test", "DISPATCHER"],
  ["invite kim@acme.test as dispatcher", "kim@acme.test", "DISPATCHER"],
  ["invite leo@acme.test as viewer", "leo@acme.test", "VIEWER"],
];

const NON_ACTION = [
  "which lanes lost money",
  "worst project last week",
  "show me the brief",
  "upload a file",
  "help",
  "hello",
  "what is detention",
  "monday brief",
  "show detention last week",
  "fuel spend",
];

describe("NL-action eval set (R-131/R-139)", () => {
  for (const [input, field, threshold] of FLAG_CASES) {
    it(`"${input}" → flag ${field} > ${threshold}`, () => {
      const a = parseAction(input);
      expect(a).not.toBeNull();
      expect(a!.action).toBe("flag");
      expect(a!.params.field).toBe(field);
      expect(a!.params.threshold).toBe(threshold);
      expect(validateActionParams(a!)).toBeNull();
    });
  }

  it("alert / rerun / export / invite intents parse", () => {
    for (const [input, group] of ALERT_CASES) {
      const a = parseAction(input, input.includes("project") ? "agency" : "freight");
      expect(a, input).not.toBeNull();
      expect(a!.action).toBe("alert");
      expect(a!.params.group).toBe(group);
    }
    for (const input of RERUN_CASES) {
      expect(parseAction(input), input).toMatchObject({ action: "rerun" });
    }
    for (const input of EXPORT_CASES) {
      expect(parseAction(input), input).toMatchObject({ action: "export" });
    }
    for (const [input, email, role] of INVITE_CASES) {
      const a = parseAction(input);
      expect(a, input).not.toBeNull();
      expect(a!.action).toBe("invite");
      expect(a!.params.email).toBe(email);
      expect(a!.params.role).toBe(role);
    }
    expect(parseAction("alert when project acme drops", "agency")).toMatchObject({
      action: "alert",
      params: { group: "acme" },
    });
  });

  it("non-action queries return null (NL answers still handle them)", () => {
    for (const input of NON_ACTION) {
      expect(parseAction(input), input).toBeNull();
    }
    expect(parseAction("")).toBeNull();
  });

  it("every action has a plain-English description (R-136 confirmation copy)", () => {
    for (const q of ["flag all detention over $50", "notify me when lane X drops", "re-run", "export", "invite a@b.test as dispatcher"]) {
      const a = parseAction(q);
      if (!a) continue;
      expect(describeAction(a).length).toBeGreaterThan(0);
    }
    expect(describeAction({ action: "alert", params: {}, raw: "" })).toMatch(/name the lane/);
    expect(validateActionParams({ action: "alert", params: {}, raw: "" })).toBe("name the group to watch");
    expect(validateActionParams({ action: "invite", params: {}, raw: "" })).toBe("email address required");
    expect(validateActionParams({ action: "flag", params: { threshold: -5 }, raw: "" })).toBe("threshold must be positive");
  });
});
