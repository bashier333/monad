import { describe, expect, it } from "vitest";
import { personalOrgName, personalSlugBase } from "@/lib/core/provision";

describe("personal provisioning names", () => {
  it("derives a clean slug base from email", () => {
    expect(personalSlugBase("Bashier.Turner+work@Example.COM")).toBe("bashier-turner-work");
    expect(personalSlugBase(null)).toBe("workspace");
    expect(personalSlugBase("!!!@x.com")).toBe("workspace");
  });

  it("names the org after the user", () => {
    expect(personalOrgName("sam@co.com")).toBe("sam's workspace");
    expect(personalOrgName(null)).toBe("My workspace");
  });
});
