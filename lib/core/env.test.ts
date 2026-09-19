import { describe, expect, it } from "vitest";
import { checkProductionSecrets } from "@/lib/core/env";

describe("production secret guard (S-645)", () => {
  it("refuses dev defaults in production", () => {
    expect(checkProductionSecrets({ NODE_ENV: "production", AUTH_SECRET: "dev-only-secret-replace-me" })).toMatch(/AUTH_SECRET/);
    expect(checkProductionSecrets({ NODE_ENV: "production", AUTH_SECRET: "short" })).toMatch(/AUTH_SECRET/);
    expect(checkProductionSecrets({ NODE_ENV: "production" })).toMatch(/AUTH_SECRET/);
  });

  it("passes real secrets and non-prod", () => {
    expect(checkProductionSecrets({ NODE_ENV: "production", AUTH_SECRET: "x".repeat(32) })).toBeNull();
    expect(checkProductionSecrets({ NODE_ENV: "development", AUTH_SECRET: "dev-only-secret-replace-me" })).toBeNull();
    expect(checkProductionSecrets({})).toBeNull();
  });
});
