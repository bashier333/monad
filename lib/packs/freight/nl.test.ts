import { parseQuery, type NlIntent } from "./nl";
import { describe, expect, it } from "vitest";

const CASES: Array<[string, NlIntent]> = [
  ["which lanes lost money", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["which lanes lost money last week", { view: "lanes", topic: "losers", weekOffset: -1 }],
  ["show losing lanes", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["worst lane", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["where are we bleeding", { view: "lanes", topic: "losers", weekOffset: 0 }],
  ["unprofitable lanes last week", { view: "lanes", topic: "losers", weekOffset: -1 }],
  ["best lane", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["most profitable lanes", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["top lanes this week", { view: "lanes", topic: "winners", weekOffset: 0 }],
  ["winning lanes last week", { view: "lanes", topic: "winners", weekOffset: -1 }],
  ["detention", { view: "lanes", topic: "detention", weekOffset: 0 }],
  ["show detention last week", { view: "lanes", topic: "detention", weekOffset: -1 }],
  ["detention charges", { view: "lanes", topic: "detention", weekOffset: 0 }],
  ["broker fees", { view: "lanes", topic: "fees", weekOffset: 0 }],
  ["factoring fees last week", { view: "lanes", topic: "fees", weekOffset: -1 }],
  ["fees by lane", { view: "lanes", topic: "fees", weekOffset: 0 }],
  ["factor costs", { view: "lanes", topic: "fees", weekOffset: 0 }],
  ["fuel spend", { view: "lanes", topic: "fuel", weekOffset: 0 }],
  ["fuel last week", { view: "lanes", topic: "fuel", weekOffset: -1 }],
  ["lane dallas houston", { view: "lane", lane: "dallas houston", weekOffset: 0 }],
  ["lane dallas houston last week", { view: "lane", lane: "dallas houston", weekOffset: -1 }],
  ["show lane phoenix el paso", { view: "lane", lane: "phoenix el paso", weekOffset: 0 }],
  ["monday brief", { view: "brief", weekOffset: 0 }],
  ["show the report", { view: "brief", weekOffset: 0 }],
  ["weekly summary last week", { view: "brief", weekOffset: -1 }],
  ["upload a file", { view: "upload" }],
  ["import tms export", { view: "upload" }],
  ["connect my data", { view: "upload" }],
  ["help", { view: "help" }],
  ["how do i correct a cost", { view: "help" }],
];

describe("NL query eval set (B-088, 30 cases)", () => {
  for (const [input, expected] of CASES) {
    it(`"${input}"`, () => {
      expect(parseQuery(input)).toEqual(expected);
    });
  }
});
