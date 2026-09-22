# Route Audit Head — verification record (F2-14551+ J aspects)

Method: enumerated all 112 route files; grepped for `requireCan`,
`requireJson`, `logAccess`, org scoping. Global gates already enforce:
auth-or-public (`tests/routes.test.ts`), org scoping (`security-audit`),
method contracts (EXPECTED map). This record covers what the global
gates cannot see.

## Findings + fixes (this block)

- 3 mutating dry-run routes wrote no audit trail: `answers/whatif`,
  `rules/preview`, `ontology/actions/preview` (both mfg + generic paths).
  Fixed: `logAccess` on every success return (actor + target). Previews
  don't mutate, but who-previewed-what belongs in the trail.
- Read routes (43 without `requireCan`) intentionally use session + org
  scoping only: tenancy comes from `getActiveOrg`, never from client
  input. Bolting role gates onto reads would break viewers' core flows;
  the security-audit gate proves scoping per route. Mutations all carry
  role gates — verified by grep, zero exceptions outside documented
  public routes (health, share tokens, auth handler, check demo,
  downloads, updater feed, webhooks with signature verification).
- Idempotency: required on money-adjacent and write paths
  (`executeAction` key replay, billing webhooks, imports dedupe).
  Pure previews and reads are naturally idempotent.
- Error copy: mutating routes return field-level 400s; unexpected
  failures map to 400/404/409 with reasons, never stack traces
  (see docs/error-copy.md).
- Perf: route budgets enforced at system level (CI perf harness +
  k6 scripts), not per-route middleware. p95 answer <2s, drill-down <1s.
- Tenancy proof: `scripts/tenancy-check.ts` + contract tests per route.
- Docs: `docs/api.md` + `docs/api-changelog.md` record the surface;
  this file records the audit.

## Standing rules for new routes (from this audit)

1. Session → org → role gate → JSON guard → writable check → handler → audit log. In that order.
2. Public routes go in BOTH allowlists (routes.test + security-audit) with a one-line justification.
3. Dry-runs log reads; anything else logs writes. No silent endpoints.
4. Share-token auth documents what the token grants and how it revokes.

## Page audit head — 14 app pages (K aspects)

Audited activity, admin, admin/roles, answers (+lane/project/projects),
briefs (+[week]/variant), corrections, dashboard, imports/[id],
ontology/[key] against: auth gate, empty state, error state, help link,
mobile/keyboard/theme, deep links, tour, telemetry, stale handling, roles.

- Auth: 13/14 gate via session (dashboard is a documented sunset redirect
  to /workspace — exempt by design, workspace gates).
- Empty states: 13/14 render explicit empties (same exemption).
- Error states: added root `app/error.tsx` + `app/global-error.tsx`
  (retry + way home, no leaked details). Previously only /ontology had a
  boundary — app-wide crashes white-screened.
- Help: global TopNav links /help — per-page links redundant by design.
- Mobile/keyboard/theme: shared primitives + ds tokens; verified by
  inspection (no per-page snowflakes found).
- Marketing pages (`app/(marketing)/*`) belong to the parallel UI track
  and were not touched by this audit.

## Page audit tail — 18 more pages (K aspects)

ontology/actions, audit, automations, explore, inbox, ops, studio,
scenarios, twin, packs, pilots, rules, search, settings, signin, sync,
upload, workspace: all session-gated except signin (the auth page itself)
and search (client page, enforced at `/api/search` 401 with inline error
display). Empty states verified: audit/board, ops/boards, scenarios
manager and twin/board all render explicit empties in their data
components. No gaps found — recorded, not changed.
