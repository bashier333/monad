# FinOps templates (R-941/R-942/R-943/R-946) + vendor/expense notes

## Monthly close checklist (R-941, <5 days)

1. Stripe payouts reconcile (`scripts/reconcile-billing.ts`).
2. Finance export reviewed (tiers, MRR movement).
3. Metered events spot-checked vs Stripe usage.
4. Costs API reviewed (storage + compute; LLM $0 until agents ship).
5. Close note filed with date.

## Board metrics pack (R-942)

Activation (first answer <1d), NRR, anomaly precision, eval scores, p95 latencies,
MRR movement, runway. Same pack monthly (R-987).

## Runway (R-943)

Cash tracked monthly, 18mo+ target. Pricing/packaging changes get finance sign-off
(R-944 note: pricing council logs live with the drift-check runbook).

## Expense policy (R-946)

Simple, trusted, audited: spend like it's yours, receipts over $25, monthly review.
Vendors: contracts + renewals calendar (R-945 note — calendar item, owner: founder).
