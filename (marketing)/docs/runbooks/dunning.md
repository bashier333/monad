# Dunning (P-207–P-212) — Stripe sends, we track

Configure in Stripe dashboard → Billing → Revenue recovery using this copy. Our webhook
(`invoice.payment_failed` → `past_due` + clock) does the enforcement; these emails do the
persuading. Nothing is ever deleted for non-payment — read-only at day 21, data intact.

## Day 3 — helpful nudge

Subject: "Payment hiccup on [Product] — one click to fix"
Body: card ending {last4} failed ({reason}). Update here: {portal link}. Your data and team
are untouched. Reply to this email and a human helps within 4 hours.

## Day 7 — firmer

Subject: "Action needed: [Product] will go read-only in 14 days"
Body: second attempt failed. Update payment: {portal link}. Read-only means: view everything,
change nothing. Nothing is deleted, ever.

## Day 14 — final notice

Subject: "Final notice: read-only starts in 7 days"
Body: last chance before read-only. After read-only starts, one successful payment restores
full access within 5 minutes, with all history intact.

## Recovery + tracking

- `invoice.payment_succeeded` clears past_due immediately (webhook-tested).
- Dunning state visible per org in `/api/admin/failures` (pastDue field).
- Recovery rate = succeeded-within-21d / failed — review monthly in finance export.
- Email send log lives in Stripe (dashboard → Billing → Revenue recovery); our side logs
  status transitions with requestIds.
- Refunds: full/partial in Stripe dashboard; data retention unchanged (90-day rule still
  applies from cancel date, never from refund date).
