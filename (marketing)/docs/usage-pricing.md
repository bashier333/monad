# Usage pricing prep (P-222/P-224, E-472)

Status: designed, not live. Team is flat-rate; this activates when run volume justifies it.

## Design

- Meter: `MeterEvent(kind, pack, qty)` records upload/answer_view/recompute/brief/seat
  namespaced per pack (E-475). "Runs that matter" differ per pack: freight = imports +
  lane answers; agency = time imports + project answers.
- Unit: per-1k runs/month included per tier; overage via Stripe metered billing.
- Guardrail: per-run COGS ≤30% of per-run price (see costs API; LLM $0 today).
- Alerts: 50/80/100% usage alerts already fire from `/api/billing/usage`.

## To activate

1. Create metered prices in Stripe; store IDs in env (one price per pack if split).
2. Report usage monthly (`scripts/reconcile-billing.ts` extended with usage).
3. Flip `docs/runbooks/pricing-check.md` to include metered prices.
4. Overage invoicing tested in Stripe test mode before first live invoice.
