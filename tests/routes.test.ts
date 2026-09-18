import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const API = path.join(process.cwd(), "app", "api");

function routes(dir: string, base: string): Array<{ route: string; src: string }> {
  const out: Array<{ route: string; src: string }> = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...routes(full, `${base}/${e.name}`));
    else if (e.name === "route.ts") out.push({ route: base || "/", src: readFileSync(full, "utf8") });
  }
  return out;
}

const EXPECTED: Record<string, string[]> = {
  "/uploads": ["POST", "GET"],
  "/imports": ["GET"],
  "/imports/[id]": ["GET"],
  "/imports/[id]/mapping": ["POST"],
  "/imports/[id]/decision": ["POST"],
  "/corrections": ["POST", "GET"],
  "/corrections/[id]/decide": ["POST"],
  "/corrections/revert-user": ["POST"],
  "/corrections/export": ["GET"],
  "/corrections/stats": ["GET"],
  "/rules": ["POST", "GET"],
  "/rules/[id]": ["PATCH"],
  "/rules/preview": ["POST"],
  "/aliases": ["POST", "GET"],
  "/answers/lane-margins": ["GET"],
  "/answers/lane": ["GET"],
  "/answers/export": ["GET"],
  "/answers/share": ["POST", "DELETE"],
  "/answers/recompute": ["POST"],
  "/share/[token]": ["GET"],
  "/briefs/generate": ["POST", "GET"],
  "/briefs/variant": ["GET"],
  "/briefs/[id]/feedback": ["POST"],
  "/email/unsubscribe": ["GET"],
  "/billing/checkout": ["POST"],
  "/billing/portal": ["POST"],
  "/billing/pause": ["POST"],
  "/billing/invoices": ["GET"],
  "/billing/cancel-survey": ["POST"],
  "/billing/webhook": ["POST"],
  "/billing/status": ["GET"],
  "/billing/usage": ["GET"],
  "/demo/seed": ["POST"],
  "/demo/graduate": ["POST"],
  "/org/invites": ["POST", "GET", "DELETE"],
  "/org/settings": ["PATCH"],
  "/org/data": ["GET", "DELETE"],
  "/notifications": ["GET", "POST"],
  "/health": ["GET"],
  "/auth/[...nextauth]": ["GET", "POST"],
  "/admin/sweep": ["POST"],
  "/admin/failures": ["GET"],
  "/admin/costs": ["GET"],
  "/admin/anomalies": ["GET"],
  "/admin/finance": ["GET"],
  "/pilots/checklist": ["GET", "PATCH"],
  "/imports/[id]/errors": ["GET"],
  "/debug-error": ["GET"],
};

describe("API contract surface (B-084)", () => {
  const found = routes(API, "");
  it("has exactly the expected routes", () => {
    expect(found.map((f) => f.route).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
  for (const f of found) {
    it(`${f.route} exports ${EXPECTED[f.route].join("/")}`, () => {
      for (const m of EXPECTED[f.route]) {
        const fn = new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b`);
        const destructure = new RegExp(`export\\s+const\\s+\\{[^}]*\\b${m}\\b`);
        expect(fn.test(f.src) || destructure.test(f.src)).toBe(true);
      }
    });
  }
  it("every route enforces auth or is explicitly public", () => {
    const publicRoutes = new Map([
      ["/health", "liveness probe"],
      ["/share/[token]", "bearer-token link"],
      ["/auth/[...nextauth]", "auth handler itself"],
      ["/email/unsubscribe", "HMAC-signed link"],
      ["/debug-error", "dev-only, 404s in production"],
      ["/billing/webhook", "Stripe-signature verified, not session-authed"],
    ]);
    for (const f of found) {
      if (publicRoutes.has(f.route)) continue;
      expect(f.src.includes("unauthorized")).toBe(true);
    }
  });
});
