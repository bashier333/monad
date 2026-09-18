import { parseAgencyQuery, type NlIntent } from "./nl";
import { describe, expect, it } from "vitest";

const CASES: Array<[string, NlIntent]> = [
  ["which projects lost money", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["which projects lost money last week", { view: "lanes", topic: "losers", weekOffset: -1 }],
  ["show losing projects", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["worst project", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["where are we bleeding", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["unprofitable projects last week", { view: "lanes", topic: "losers", weekOffset: -1 }],
  ["best project", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["most profitable projects", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["top projects this week", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["winning projects last week", { view: "lanes", topic: "winners", weekOffset: -1 }],
  ["rework cost", { view: "lanes", topic: "rework", weekOffset: 0 }],
  ["show rework last week", { view: "lanes", topic: "rework", weekOffset: -1 }],
  ["revision rounds by project", { view: "lanes", topic: "rework", weekOffset: 0 }],
  ["too many rounds", { view: "lanes", topic: "rework", weekOffset: 0 }],
  ["approval delays", { view: "lanes", topic: "approvals", weekOffset: 0 }],
  ["approvals stuck last week", { view: "lanes", topic: "approvals", weekOffset: -1 }],
  ["waiting on signoff", { view: "lanes", topic: "approvals", weekOffset: 0 }],
  ["bottlenecks", { view: "lanes", topic: "bottlenecks", weekOffset: 0 }],
  ["what is stuck", { view: "lanes", topic: "bottlenecks", weekOffset: 0 }],
  ["late projects last week", { view: "lanes", topic: "bottlenecks", weekOffset: -1 }],
  ["project acme site", { view: "lane", lane: "acme site", weekOffset: 0 }],
  ["project acme site last week", { view: "lane", lane: "acme site", weekOffset: -1 }],
  ["show project beta logo", { view: "lane", lane: "beta logo", weekOffset: 0 }],
  ["monday brief", { view: "brief", weekOffset: 0 }],
  ["show the report", { view: "brief", weekOffset: 0 }],
  ["weekly summary last week", { view: "brief", weekOffset: -1 }],
  ["upload a file", { view: "upload" }],
  ["import harvest export", { view: "upload" }],
  ["connect my data", { view: "upload" }],
  ["help", { view: "help" }],
];

describe("agency NL eval set (X5 E-226, 30 cases)", () => {
  for (const [input, expected] of CASES) {
    it(`"${input}"`, () => {
      expect(parseAgencyQuery(input)).toEqual(expected);
    });
  }
});
