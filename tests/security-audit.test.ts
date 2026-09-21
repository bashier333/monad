import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const API = path.join(process.cwd(), "app", "api");
const APP = path.join(process.cwd(), "app");
const COMPONENTS = path.join(process.cwd(), "components");
const LIB = path.join(process.cwd(), "lib");

function routes(dir: string, base: string): Array<{ route: string; src: string }> {
  const out: Array<{ route: string; src: string }> = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...routes(full, `${base}/${e.name}`));
    else if (e.name === "route.ts") out.push({ route: base || "/", src: readFileSync(full, "utf8") });
  }
  return out;
}

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const BERB = ["POST", "PATCH", "DELETE"];
const NO_AUTHZ_NEEDED = new Set([
  "/auth/[...nextauth]",
  "/health",
  "/share/[token]",
  "/email/unsubscribe",
  "/debug-error",
  "/billing/webhook",
  "/hooks/[slug]",
]);
const NO_LOG_NEEDED = new Set([
  "/health",
  "/share/[token]",
  "/email/unsubscribe",
  "/debug-error",
  "/auth/[...nextauth]",
  "/v2/answers",
  "/v2/imports",
  "/search",
  "/hooks/[slug]",
  "/answers/whatif",
  "/rules/preview",
  "/ontology/actions/preview",
  "/billing/webhook",
]);

function exportedMethods(src: string): string[] {
  const out: string[] = [];
  for (const m of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
    if (new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`).test(src)) out.push(m);
  }
  return out;
}

describe("security audit gates (D1/D2/D9)", () => {
  const found = routes(API, "");

  it("every mutating route enforces authorization (S-154/S-161–S-170)", () => {
    const bad: string[] = [];
    for (const f of found) {
      if (NO_AUTHZ_NEEDED.has(f.route)) continue;
      const methods = exportedMethods(f.src).filter((m) => BERB.includes(m));
      if (methods.length === 0) continue;
      if (!f.src.includes("requireCan") && !f.src.includes("session?.user?.id")) {
        bad.push(`${f.route} [${methods.join(",")}]`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every mutating route logs the mutation (S-801–S-810)", () => {
    const bad: string[] = [];
    for (const f of found) {
      if (NO_LOG_NEEDED.has(f.route)) continue;
      const methods = exportedMethods(f.src).filter((m) => BERB.includes(m));
      if (methods.length === 0) continue;
      if (!f.src.includes("logAccess")) bad.push(`${f.route} [${methods.join(",")}]`);
    }
    expect(bad).toEqual([]);
  });

  it("every data route scopes to the caller org (S-101–S-150 IDOR families)", () => {
    const publicRoutes = new Set([
      "/health",
      "/share/[token]",
      "/auth/[...nextauth]",
      "/email/unsubscribe",
      "/debug-error",
      "/billing/webhook",
      "/hooks/[slug]",
    ]);
    const legitimatelyUnscoped = new Set([
      "/admin/queue",
      "/packs",
      "/ontology/export",
      "/download/exe",
      "/updates/latest.yml",
      "/updates/[file]",
      "/desktop",
      "/desktop/bootstrap",
    ]);
    const bad: string[] = [];
    for (const f of found) {
      if (publicRoutes.has(f.route)) continue;
      if (legitimatelyUnscoped.has(f.route)) continue;
      if (!f.src.includes("organizationId") && !f.src.includes("orgId") && !f.src.includes("organization.id")) {
        bad.push(f.route);
      }
    }
    expect(bad).toEqual([]);
  });

  it("no dangerouslySetInnerHTML in UI (D4 render families)", () => {
    const bad: string[] = [];
    for (const f of [...sources(APP), ...sources(COMPONENTS)]) {
      if (f.endsWith("route.ts")) continue;
      const src = readFileSync(f, "utf8");
      if (src.includes("dangerouslySetInnerHTML")) bad.push(path.relative(process.cwd(), f));
    }
    expect(bad).toEqual([]);
  });

  it("no secrets in client components (S-642/S-651)", () => {
    const bad: string[] = [];
    for (const f of sources(COMPONENTS)) {
      const src = readFileSync(f, "utf8");
      for (const secret of ["AUTH_SECRET", "STRIPE_SECRET_KEY", "AUTH_GOOGLE_SECRET", "AUTH_RESEND_KEY", "DATABASE_URL"]) {
        if (src.includes(secret)) bad.push(`${path.relative(process.cwd(), f)}: ${secret}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("zero string-interpolated SQL (S-204)", () => {
    const bad: string[] = [];
    for (const f of [...sources(LIB), ...sources(APP)]) {
      const src = readFileSync(f, "utf8");
      if (/\$queryRaw`[^`]*\$\{/.test(src) || /\$executeRaw`[^`]*\$\{/.test(src)) {
        bad.push(path.relative(process.cwd(), f));
      }
    }
    expect(bad).toEqual([]);
  });

  it("error responses never include stacks (S-365)", () => {
    const bad: string[] = [];
    for (const f of found) {
      if (/\.stack\b/.test(f.src)) bad.push(f.route);
    }
    expect(bad).toEqual([]);
  });

  it("price IDs come from env, never hardcoded (S-667)", () => {
    const bad: string[] = [];
    for (const f of [...sources(LIB), ...sources(APP)]) {
      const src = readFileSync(f, "utf8");
      if (/price_[A-Za-z0-9]{10,}/.test(src)) bad.push(path.relative(process.cwd(), f));
    }
    expect(bad).toEqual([]);
  });
});
