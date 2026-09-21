# Quality gates (X9 process notes)

## Suites (E-401–E-404)

`npm run test` (271 tests), `typecheck`, `lint`, `build` — all green required.
Pack paths (`lib/packs/*`) run inside the same suite; core tests run against both
packs (agency corpus exercises core parse/detect/apply/validate paths). No suite
shrink to pass: the 200-test floor is checked by counting `it(` in CI output.

## Flaky process (E-405)

3 strikes → quarantine the test file with a ticket, fix within a week, or delete
the test and its feature. No retries in CI.

## Coverage (E-411–E-413)

`npm run test:coverage`. Gate: 80% lines/functions overall, ≥90% on new pack
engines. Every PR justifies uncovered lines or adds tests. DB-touching code is
covered via staging scripts (tenancy-check, staging-perf, e2e-pack), noted here.

## Evals (E-419/E-420/E-424)

Freight NL 30-case + agency NL 30-case + cross-pack no-collision run in CI and
block merge. Failures are fixed same-day; stale cases pruned monthly (E-425, calendar).

## Contracts (E-437/E-438)

`tests/routes.test.ts` is the route manifest: exact surface + auth audit
(every non-public route returns `unauthorized`). New pack routes are added to
EXPECTED in the same PR — CI fails otherwise. Runs in seconds (E-444).
Public allowlist: /health, /share/[token], auth handler, unsubscribe (HMAC),
debug-error (dev-only 404 in prod), billing webhook (Stripe-signed).
