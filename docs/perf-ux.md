# Perf UX (R-468)

## Budgets

- Page JS ≤150kB per route (verified in build output; `scripts/bundle-budget.ts` gates post-build).
- Answers p95 <2s (k6 soak/spike per pack; server timings in `scripts/staging-perf.ts`).
- Search p95 <300ms (route warns over budget; 5k-row matcher test in CI).
- Engines ≤2000ms/100k rows (`bench-shapes` freight + agency, CI-adjacent).

## Patterns

- Skeletons on every async surface (`loading.tsx`): answers, projects, project, briefs.
- Optimistic UI: flag dialogs confirm instantly, reconcile with the server after.
- Prefetch: WeekPicker prefetches ±1 week; Next links prefetch by default.
- Pagination past 100 rows server-side (`?n=`), DOM stays small.
- Degraded mode: tables scroll horizontally at 360px; tap targets ≥44px.
- Web Vitals: `VitalsReporter` ships field data; regressions fail CI via budgets.
- Realtime fallback (R-039): import progress polls (`ImportProgress`); no sockets.
  When websockets land, polling stays as the documented fallback.
