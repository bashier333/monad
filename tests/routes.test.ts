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
  "/corrections/bulk": ["POST"],
  "/corrections/[id]/decide": ["POST"],
  "/corrections/revert-user": ["POST"],
  "/corrections/export": ["GET"],
  "/corrections/stats": ["GET"],
  "/rules": ["POST", "GET"],
  "/rules/[id]": ["PATCH"],
  "/rules/preview": ["POST"],
  "/aliases": ["POST", "GET"],
  "/answers/lane-margins": ["GET"],
  "/answers/project-margins": ["GET"],
  "/answers/action": ["POST"],
  "/answers/whatif": ["POST"],
  "/answers/lane": ["GET"],
  "/playbooks": ["GET", "POST"],
  "/playbooks/[id]": ["GET", "POST", "DELETE"],
  "/hooks/replay": ["POST"],
  "/org/deletion": ["GET", "POST"],
  "/search": ["GET"],
  "/keys": ["GET", "POST", "DELETE"],
  "/hooks/[slug]": ["POST"],
  "/v2/answers": ["GET"],
  "/v2/imports": ["GET"],
  "/org": ["GET", "POST"],
  "/org/switch": ["POST"],
  "/org/transfer": ["POST"],
  "/packs": ["GET"],
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
  "/auth/sessions": ["GET", "DELETE"],
  "/admin/sweep": ["POST"],
  "/admin/queue": ["GET"],
  "/admin/packs": ["GET"],
  "/admin/failures": ["GET"],
  "/admin/costs": ["GET"],
  "/admin/anomalies": ["GET"],
  "/admin/finance": ["GET"],
  "/pilots/checklist": ["GET", "PATCH"],
  "/imports/[id]/errors": ["GET"],
  "/debug-error": ["GET"],
  "/ontology/types": ["POST", "GET"],
  "/ontology/types/[key]": ["GET", "PATCH", "DELETE"],
  "/ontology/links": ["POST", "GET"],
  "/ontology/objects": ["POST", "GET"],
  "/ontology/objects/[id]/facts": ["POST", "GET"],
  "/ontology/edges": ["POST", "DELETE"],
  "/ontology/traverse": ["GET"],
  "/ontology/measures/evaluate": ["POST"],
  "/ontology/actions": ["POST", "GET"],
  "/ontology/actions/execute": ["POST"],
  "/ontology/actions/preview": ["POST"],
  "/ontology/objects/by-ids": ["GET"],
  "/ontology/events": ["GET"],
  "/alerts": ["GET", "POST", "PATCH", "DELETE"],
  "/ontology/approvals": ["POST", "GET", "PATCH"],
  "/ontology/branches": ["POST", "GET"],
  "/ontology/branches/changes": ["POST", "PUT"],
  "/ontology/packs/export": ["GET"],
  "/ontology/export": ["GET"],
  "/download/request": ["POST"],
  "/download/exe": ["GET"],
  "/updates/latest.yml": ["GET"],
  "/updates/[file]": ["GET"],
  "/check": ["POST"],  "/ontology/search": ["GET"],
  "/ontology/policies": ["POST", "GET"],
  "/ontology/policies/simulate": ["POST"],
  "/ontology/audit/verify": ["GET"],
  "/ontology/packs/seed": ["POST"],
  "/agent/run": ["POST"],
  "/agent/confirm": ["POST"],
  "/agent/evals": ["GET"],
  "/desktop": ["GET"],
  "/desktop/bootstrap": ["GET"],
  "/webhooks": ["GET", "POST", "PATCH", "DELETE"],
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
      ["/hooks/[slug]", "org-secret HMAC/Bearer verified, not session-authed"],
      ["/download/request", "public waitlist, rate-limited, validated, no data access"],
      ["/download/exe", "public binary download, fixed server-path file, no org data"],
      ["/updates/latest.yml", "public update feed for the exe updater, derived from dist/ artifacts only, no org data"],
      ["/updates/[file]", "public updater artifact download, strict filename allowlist, no org data"],
      ["/check", "public demo check, rate-limited, validated, cached"],
      ["/ontology/export", "public ontology definition download, pack constants only, no org data"],
      ["/desktop", "public capability flag, reads no org data"],
      ["/desktop/bootstrap", "exe auto-sign-in: provisions machine org + session cookie, desktop mode only"],
    ]);
    for (const f of found) {
      if (publicRoutes.has(f.route)) continue;
      expect(f.src.includes("unauthorized")).toBe(true);
    }
  });
});
