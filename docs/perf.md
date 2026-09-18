# Perf notes (B-050, B-089)

## Engine (pure function, `npm run perf`)

- 2026-09-18: 100,000 synthetic loads â†’ 6 lanes in **1817ms** (budget 2000ms). Tight but passing.
- 2026-09-18 per-shape 50k (`npm run perf:shapes`): mcleod 403ms, tmw 388ms, prophesy 525ms,
  ascend 557ms, generic 557ms. All well under budget; shape of origin names doesn't move cost.
- Cost drivers: per-load object churn + fuel allocation maps. If it breaches: pre-aggregate per
  (truck, week) before allocating, and skip CostLine objects for zero-amount lines (already done).
- DB fetch of 100k JSON rows is NOT included â€” measure on staging with `EXPLAIN ANALYZE`
  once Postgres exists. If fetch dominates, add a covering index on
  (organizationId, status) and paginate by week using run date ranges.

## Load test (B-089, staging)

- Not yet run (needs DB + deployed env). Runbook: 5 concurrent recomputes (hit lane-margins
  with 5 different weeks) + 50 answer viewers; record p95 from server logs; capacity target: 10 pilots.

## Load test scripts (P-355–P-358)

- k6 scripts checked in (k6/recompute.js, viewers.js, soak.js, spike.js) — run against staging with BASE + SESSION env. Not yet run (needs deployed env + k6 binary).
- Capacity target: 10 pilots. If p95 > 2s: covering indexes (see 0010 migration), then per-(org, week) materialized answers.

## Frontend budgets (P-350/P-352, from production build)

- First load shared: 103kB; heaviest page (/settings) 108kB — under the 150kB budget.
- Landing: static, no data fetch — well under 200kB.
- Re-audit on every dependency addition (next build output is the audit).
