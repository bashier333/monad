import { describe, expect, it } from "vitest";
import { buildLatestYml, compareVersions, parseSetupVersion, pickNewest } from "@/lib/core/updates";

describe("update feed model (U-001+)", () => {
  it("parses versions from Setup filenames only", () => {
    expect(parseSetupVersion("Monad-Ontology-Setup-1.2.0.exe")).toBe("1.2.0");
    expect(parseSetupVersion("Monad-Ontology-Setup-1.2.0-beta.1.exe")).toBe("1.2.0-beta.1");
    expect(parseSetupVersion("  Monad-Ontology-Setup-10.0.3.exe  ")).toBe("10.0.3");
    expect(parseSetupVersion("Monad-Ontology-1.2.0.exe")).toBeNull();
    expect(parseSetupVersion("Monad-Ontology-win64.zip")).toBeNull();
    expect(parseSetupVersion("../../../etc/passwd")).toBeNull();
    expect(parseSetupVersion("Monad-Ontology-Setup-.exe")).toBeNull();
  });

  it("orders versions numerically, release beats prerelease", () => {
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.0", "1.2.0-beta.1")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0-alpha", "1.2.0-beta")).toBeLessThan(0);
    expect(compareVersions("garbage", "1.2.0")).toBe(0);
  });

  it("picks newest by version, skipping invalid entries", () => {
    const mk = (filename: string, version: string) => ({ filename, version, size: 1, sha512Base64: "x", mtimeMs: 0 });
    expect(
      pickNewest([mk("a", "1.2.0"), mk("b", "1.10.0"), mk("c", "nope")])?.version
    ).toBe("1.10.0");
    expect(pickNewest([])).toBeNull();
    expect(pickNewest([mk("c", "nope")])).toBeNull();
  });

  it("renders the generic-provider document with version first", () => {
    const yml = buildLatestYml({
      version: "1.2.0",
      filename: "Monad-Ontology-Setup-1.2.0.exe",
      size: 325642032,
      sha512Base64: "abc123==",
      releaseDate: "2026-09-21T00:00:00.000Z",
    });
    const lines = yml.split("\n");
    expect(lines[0]).toBe("version: 1.2.0");
    expect(yml).toContain("url: Monad-Ontology-Setup-1.2.0.exe");
    expect(yml).toContain("sha512: abc123==");
    expect(yml).toContain("size: 325642032");
    expect(yml).toContain("path: Monad-Ontology-Setup-1.2.0.exe");
    expect(yml).toContain("releaseDate: '2026-09-21T00:00:00.000Z'");
  });
});
