import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ORG_DATA_TABLES } from "@/lib/core/org-data";

describe("delete-everything coverage (S-521–S-527)", () => {
  it("covers every org-scoped table incl. platform tables", () => {
    for (const t of [
      "brief",
      "standingRule",
      "correction",
      "answerShare",
      "placeAlias",
      "columnMapping",
      "importRun",
      "dataFile",
      "meterEvent",
      "accessLog",
      "pilotChecklist",
      "notification",
      "eventLog",
      "webhookEndpoint",
      "apiKey",
      "alertRule",
      "workflowRun",
      "workflowPlaybook",
      "orgDeletion",
    ]) {
      expect(ORG_DATA_TABLES as readonly string[]).toContain(t);
    }
  });

  it("deleteOrgData touches every listed table", () => {
    const src = readFileSync(path.join(process.cwd(), "lib", "core", "org-data.ts"), "utf8");
    for (const t of ORG_DATA_TABLES) {
      expect(src, t).toContain(`db.${t}.deleteMany`);
    }
  });

  it("keeps tenancy tables out (org, membership, subscription, user)", () => {
    const src = readFileSync(path.join(process.cwd(), "lib", "core", "org-data.ts"), "utf8");
    expect(src).not.toContain("db.organization.delete");
    expect(src).not.toContain("db.membership.delete");
    expect(src).not.toContain("db.subscription.delete");
    expect(src).not.toContain("db.user.delete");
  });
});
