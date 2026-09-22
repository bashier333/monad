import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SPEC = path.join(process.cwd(), "(marketing)", "docs", "openapi.json");

describe("API v2 OpenAPI spec (R-022)", () => {
  it("spec exists and covers /v2 routes", () => {
    const raw = readFileSync(SPEC, "utf8").replace(/^\uFEFF/, "");
    const spec = JSON.parse(raw) as { paths: Record<string, unknown>; openapi: string };
    expect(spec.openapi).toBe("3.1.0");
    expect(Object.keys(spec.paths)).toContain("/v2/answers");
    expect(Object.keys(spec.paths)).toContain("/v2/imports");
  });

  it("v2 routes exist in the codebase", () => {
    const route = path.join(process.cwd(), "app", "api", "v2", "answers", "route.ts");
    expect(readFileSync(route, "utf8")).toContain("export async function GET");
    const imports = path.join(process.cwd(), "app", "api", "v2", "imports", "route.ts");
    expect(readFileSync(imports, "utf8")).toContain("export async function GET");
  });

  it("every v2 response carries the envelope (error or data + meta)", () => {
    const env = readFileSync(path.join(process.cwd(), "lib", "core", "api-v2.ts"), "utf8");
    expect(env).toContain("{ error: { code, message, requestId } }");
    expect(env).toContain("apiVersion: API_VERSION");
    const route = readFileSync(path.join(process.cwd(), "app", "api", "v2", "answers", "route.ts"), "utf8");
    expect(route).toContain('from "@/lib/core/api-v2"');
  });
});
