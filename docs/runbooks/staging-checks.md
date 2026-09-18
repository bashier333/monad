# Staging checks (B-069, B-085, B-014) — run against staging before every pilot

Requires a staging `DATABASE_URL` (never production). All scripts refuse localhost.

## 1. Tenancy isolation (B-069)

`npm run tenancy` (runs `tsx scripts/tenancy-check.ts`):

- Creates orgs A and B, a user in A, and a SECRET row in B.
- PASS = org-A-scoped queries return zero B rows.
- Run in CI only when `DATABASE_URL_STAGING` is set; otherwise run manually pre-pilot.

## 2. End-to-end walkthrough (B-085, manual until Playwright lands post-beta)

1. Sign up → invited to demo org.
2. Upload `fixtures/tms-week.csv` → mapping auto-detects 10/10 → 4 ok / 4 quarantined with reasons.
3. Upload `fixtures/fuel-week.csv` + `fixtures/broker-statement.csv`.
4. Open `/answers` → 2+ lanes, totals match the hand-computed sheet in `lib/margin/engine.test.ts`.
5. Drill into a lane → expand a load → every cost line links to its source file + rows.
6. Flag a detention line → approve in `/corrections` → lane margin changes, history visible.
7. Save a standing rule with preview → disable it → answer reverts.
8. Generate the Monday brief → thumbs up → print view renders.
9. Invite a viewer → viewer sees answers, cannot propose corrections (403 on POST).
10. Export everything → delete everything (confirm slug) → org is empty, members intact.

11. Device pass (360px): answers, lane, upload, imports, rules, corrections, briefs,
    settings, pilots — no horizontal scroll except inside tables, tap targets ≥44px.

## 3. Backup drill (B-014)

`pg_dump` → drop a table → restore → compare row counts. Record the run (date, duration,
row counts) below. Monthly once pilots are live.

| Date | Duration | Result |
|------|----------|--------|
| — | — | not yet run (needs staging DB) |
