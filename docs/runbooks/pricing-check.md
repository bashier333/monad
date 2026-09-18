# Pricing drift check (B-115) — monthly, 10 minutes

The pricing page (`lib/pricing.ts` → `/pricing`) and Stripe must never disagree.

## Checklist

1. Open Stripe dashboard → Product catalog → Team price. Record amount + billing interval.
2. Compare against `/pricing` Team card and `lib/pricing.ts` TIERS.
3. Compare checkout line items (`app/api/billing/checkout`) — same price ID family?
4. Check `/settings` billing panel copy for stale numbers.
5. **Tax behavior: every price must have `tax_behavior` set (exclusive), or checkout with
   `automatic_tax` fails live.** Verify on the price object; set at creation.
6. If anything drifted: fix code first, deploy, then change Stripe (never the reverse).

## Portal configuration (P-232/233/235)

- Customer portal: cancellation reasons survey ON (feeds our cancel-survey taxonomy).
- Billing contact email: customers update it in the portal (we use login email by default).
- Resubscribe preserves everything: we never delete on cancel, so history/trails/rules
  survive — verify by checking one resubscribed org's data intact.

## MRR + recovery (P-237/238)

- MRR movement (new/expansion/churn): Stripe dashboard → Analytics (source of truth until
  usage pricing ships and we store snapshots).
- Recovery rate: failed → succeeded-within-21d, from webhook transitions + finance export.

## Log

| Date | Stripe Team price | Page matches? | By |
|---|---|---|---|
| — | — | not yet run | |
