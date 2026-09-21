# Major-upgrade runbooks (S-731–S-737) + update policy (S-738)

## next (→16), react (→19.x+), prisma (→8), auth (beta→stable), stripe, xlsx/csv

1. Branch, bump, `npm ci`, full suite + coverage + build + bench-shapes + e2e-pack.
2. prisma majors: `prisma migrate diff` reviewed line-by-line before apply (S-716 note).
3. auth beta→stable: cutover plan = pin previous beta, dual-run staging 48h, rollback = repin.
4. stripe: API-version upgrade log below; webhook verify re-tested in test mode.
5. xlsx/csv replacement evaluation: lighter parser only if fixture corpus stays green.

## Stripe API-version log (S-735)

| Date | SDK | API version | Notes |
|---|---|---|---|
| 2026-09-18 | stripe v22 | account default | Pinned by SDK major; explicit before upgrade |

## Update PR policy (S-738)

Every dependency PR: test + perf evidence in the description, audit-gate green,
license unchanged. Grouped minors weekly via Renovate.

## Parser replacement evaluations (S-736/S-737)

- xlsx (SheetJS): lighter alternatives (exceljs read-only, custom zip+XML)
  rejected for now — SheetJS stays because the fixture corpus + fuzz suite pin
  its behavior, and mitigations (caps, no formulas, no external fetch) hold.
  Re-evaluate quarterly alongside the xlsx vuln.
- csv-parse: stdlib-csv alternatives rejected — `relax_column_count` + comment
  handling are load-bearing for vendor ragged rows; corpus pins behavior.
