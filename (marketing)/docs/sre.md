# SRE (R-901/R-904) + on-call notes (R-911/R-914) + tools (R-975/R-976)

## Error budgets (R-901)

99.9% monthly. Burn-rate alerts: page when 2% of budget burns in 1h, ticket at 5%/6h.
Budget source: `/api/health` + staging probes. Breaches land in the changelog postmortem.

## Runbook coverage (R-904)

Every alert links a runbook: import failures → recovery runbook; worker stalls →
stale-run sweep note; billing webhooks → Stripe dashboard drill; brief misses →
cron runbook (`docs/brief-cron.md`).

## On-call (R-911/R-914)

Fair rotation when the team exists (no heroics, load tracked). Until then: founder
carries the pager, alerts must be actionable or deleted. Severity comms use the
changelog templates (R-916 note).

## CI speed (R-975)

CI budget <10 min (workflow `timeout-minutes: 10`). Suite runs ~30s; build ~2min.
Trends watched in CI output.

## Dependencies (R-976)

Renovate config (`renovate.json`): grouped minor/patch weekly, majors manual with
eval gate. Security advisories same-day.
