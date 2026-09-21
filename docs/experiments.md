# Experiment plan — measuring the 10x, not claiming it

## Funnel events (PostHog, see `lib/analytics.ts`)

`upload_started/completed`, `mapping_confirmed`, `first_answer`,
`flag_created/decided`, `rule_created`, `brief_generated`,
`brief_opened_in_meeting`, `share_created/viewed`, `upgrade_clicked`.
Every paywall CTA reports `upgrade_clicked` with `from` (upload_402,
answers_history, pricing) so pricing CTR is measured per surface.

## Active A/B candidates (2 weeks each, one primary + one guardrail)

1. Landing CTAs — primary: demo→signup rate. Guardrail: bounce.
2. Pricing annual default — primary: checkout start rate. Guardrail: refunds.
3. 402 Upgrade copy — primary: 402→upgrade CTR. Guardrail: upload abandon.
4. Brief TL;DR vs paragraph — primary: brief_opened_in_meeting. Guardrail: feedback down-rate.
5. Share blur (3 rows) vs open — primary: share→signup. Guardrail: share_created.

## Kill gates (from the product backlogs — kept, not re-pitched)

- Trail not queried weekly → no moat → kill the vertical.
- Correction→rule < 30% → re-scope the decision surface.
- Zero Team conversion in 6 months → re-scope, not re-pitch.

## Weekly business review (metrics + decisions)

Activation: time-to-first-answer (< 1 day), memory used (> 60%).
Habit: trail queries / team / week (growing), correction→rule (> 30%).
Expansion: workspace→Team 3–5% in 6mo, NRR > 130%, GM > 80%.
Health: PQL strip on /workspace, bundle budget (`npm run budget`),
k6 p95 < 2000 (`k6/viewers.js`, `recompute.js`, `ontology-search.js`),
axe 0 serious on the 6 gated flows, Lighthouse LCP < 2500 / INP < 200 /
CLS < 0.1 / TTFB < 800 on /answers, /briefs, /ontology/twin,
/ontology/explore.

## Lab commands

- `npm run budget` (after `npm run build`; fails without a manifest).
- `npx tsx scripts/perf.ts` (engine budgets, in CI via `perf:shapes`).
- `k6 run -e BASE=... -e SESSION=... k6/ontology-search.js` (20-concurrent search).
