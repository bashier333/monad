# Dependency review (S-701–S-730, dated 2026-09-18)

Policy: stable only in prod (S-713), exact installs via lockfile (`npm ci` fails
on drift, S-769/S-772), grouped updates via Renovate (S-739), update PRs carry
test + perf evidence (S-738), licenses recorded below (S-741–S-750).

## Audit snapshot (`npm audit --omit=dev`)

- xlsx HIGH, no fix: accepted — mitigations in code (allowlist, zip magic,
  sheet/cell caps, formulas off, prototype guard). Replacement evaluated quarterly.
- next moderate → major 16 deferred (upgrade runbook first).
- csv-parse moderate → major 7 deferred (breaking API).
- prisma HIGH (via @prisma/config/deepmerge-ts) → major 8 deferred (migration risk).
- postcss HIGH → rides next 16.
- Gate: `scripts/audit-gate.ts` fails merge on NEW high/critical (S-771/S-784).

## Licenses (S-741–S-750, from package metadata)

next/react/react-dom MIT · prisma/@prisma/client Apache-2.0 · next-auth ISC ·
@auth/prisma-adapter ISC · stripe MIT · posthog-js MIT · zod MIT ·
csv-parse MIT · xlsx Apache-2.0 (confirmed, S-749) · vitest/tsx/eslint/tailwind/typescript MIT · tailwind/postcss chain MIT.
No GPL/AGPL in tree (S-793 note: manual review this date; automated ban pending tooling).
Typosquat: names/maintainers match upstream (S-751–S-759 note).

## Per-dep notes (S-701–S-730 highlights)

- next-auth beta: stable cutover tracked, rollback = pin previous beta (S-706/S-734 note).
- Adapter/DB-down: auth fails closed with retry path (S-719 note).
- Stripe: idempotency keys on checkout (S-720 done); webhook SDK verify current (S-729 note).
- posthog: autocapture OFF, replay disabled, DNT respected — payloads are
  name+value vitals only, no PII (S-709/S-721 note).
- zod: validators pick known fields, unknowns dropped (S-722 note).
- csv-parse: `relax_column_count` justified (vendor ragged rows), `comment: "#"`
  documented at call site (S-723 note).
- xlsx: read with `cellFormula: false`, sheet/cell caps; macros never execute
  (library property, S-724 note).
- middleware: edge-safe only (`crypto.randomUUID`, pure bucket) — no node APIs (S-725 note).
- server/client boundary: boundary test + no-secrets-in-components gate (S-726 note).
- generate drift: `prisma validate` in CI keeps schema honest (S-717 note).
- Major-upgrade runbooks: `docs/upgrade-runbooks.md` (S-731–S-737).
