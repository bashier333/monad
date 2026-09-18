# API docs (P-289–P-294)

Base: same origin. Auth: session cookie (all but the public list in `docs/security/auth-matrix.md`).
Errors: `{error}` JSON + `x-request-id` header. Versions: unversioned v1; breaking changes
get a 30-day notice in the changelog (P-294 policy).

## Imports (P-290)

- `POST /api/uploads` multipart(file, sourceType) → `{runId}`. 50MB/CSV-XLSX cap.
- `GET /api/uploads` → file registry with runs.
- `GET /api/imports` → run history (status filter).
- `GET /api/imports/[id]` → status, counts, mapping, errors sample, conflicts.
- `POST /api/imports/[id]/mapping` {mapping} → saves; out-of-range rejected.
- `POST /api/imports/[id]/decision` {decision: merge|replace|skip}.
- `GET /api/imports/[id]/errors` → quarantine CSV download.

## Answers (P-291)

- `GET /api/answers/lane-margins?week=` → lanes, totals, rules, meta (loads omitted).
- `GET /api/answers/lane?lane=&week=` → lane, loads with cost lines, WoW, imports.
- `GET /api/answers/export?week=&lane=` → CSV download.
- `POST /api/answers/share` {week} → 30-day read-only URL.
- `POST /api/answers/recompute` {week} → fresh totals + adjustments.
- `GET /api/briefs/variant?by=&key=&week=` → driver/truck/broker/customer/day/month slices.

## Corrections + rules (P-292)

- `POST /api/corrections` {targetKey|targets[], field, newValue, reason}.
- `GET /api/corrections?status=&proposedBy=` → queue.
- `POST /api/corrections/[id]/decide` {approve}|{revert}.
- `POST /api/corrections/revert-user` {userId} → bulk revert.
- `GET /api/corrections/stats`, `GET /api/corrections/export`.
- `POST /api/rules` {costKind, matchField, matchValue, toLoad, reason}.
- `POST /api/rules/preview` → counts, dollars moved, lane deltas.
- `PATCH /api/rules/[id]` {active} · aliases GET/POST · invites + DELETE.

## Billing + webhooks (P-293)

- `POST /api/billing/checkout` {trialDays, couponId, taxExempt} → Stripe URL.
- `POST /api/billing/portal`, `GET /api/billing/status`, `GET /api/billing/usage`,
  `GET /api/billing/invoices`, `POST /api/billing/cancel-survey`, `POST /api/billing/pause`.
- `POST /api/billing/webhook` — Stripe signatures only; replay with test clock in staging.
