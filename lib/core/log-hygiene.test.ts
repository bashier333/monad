import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

function src(...parts: string[]): string {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function allSources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) allSources(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe("log hygiene (S-551–S-556)", () => {
  it("invite/revoke logs hash emails, never plaintext (S-553/S-507)", () => {
    const route = src("app", "api", "org", "invites", "route.ts");
    expect(route).toContain("hashEmail(email)");
    expect(route).not.toMatch(/logAccess\([^)]*,\s*email\s*\)/);
  });

  it("uploads log filenames, never contents (S-552)", () => {
    const route = src("app", "api", "uploads", "route.ts");
    expect(route).toContain("upload.name");
    expect(route).not.toMatch(/logger\.(info|warn|error)\([^)]*bytes\.length[^)]*bytes[^)]*\)/);
  });

  it("access log writes never throw into the product path (S-469/S-815)", () => {
    const access = src("lib", "core", "access.ts");
    expect(access).toContain("try");
    expect(access).toContain("catch");
  });

  it("unsubscribe path logs nothing with email content (S-086)", () => {
    const route = src("app", "api", "email", "unsubscribe", "route.ts");
    expect(route).not.toContain("logger");
    expect(route).not.toContain("logAccess");
  });

  it("export asserts integrity + version (S-531/S-536)", () => {
    const route = src("app", "api", "org", "data", "route.ts");
    expect(route).toContain("EXPORT_SCHEMA_VERSION");
    expect(route).toContain("X-Export-Checksum");
  });

  it("secret values never flow into logs (S-643)", () => {
    const bad: string[] = [];
    for (const f of [...allSources(path.join(process.cwd(), "lib")), ...allSources(path.join(process.cwd(), "app"))]) {
      const text = readFileSync(f, "utf8");
      const calls = text.match(/logger\.(info|warn|error)\([^;]*\)/g) ?? [];
      for (const c of calls) {
        if (/AUTH_SECRET|STRIPE_SECRET|GOOGLE_SECRET|GITHUB_SECRET|RESEND_KEY|DATABASE_URL|hookSecret/.test(c)) {
          bad.push(`${path.relative(process.cwd(), f)}: ${c.slice(0, 80)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
