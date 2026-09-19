# Event catalog (R-009)

Schema version: 1 (`DOMAIN_EVENT_VERSION`). Every event is an object:
`{ id, type, version, orgId, pack, payload, at }`. Events persist to `EventLog`
(append-only), fan out to plugin hooks + per-org webhook endpoints (HMAC-signed,
3 retries, dead-letter on failure), and drive the derived audit trail.

| Type | When | Payload |
|---|---|---|
| `import.completed` | Run finishes COMPLETED | `{ runId, decision }` |
| `import.needs_review` | Duplicate file / overlapping week | `{ runId, dup, overlap }` |
| `answer.viewed` | Answer API viewed | logged via metering (payload minimal) |
| `correction.decided` | Correction applied/rejected/reverted | `{ correctionId, status, targetKey }` |
| `brief.generated` | Monday brief upserted + emailed | `{ briefId, week }` |
| `billing.changed` | Subscription tier/status change | from Stripe webhooks (planned wiring) |

## Retention (R-008)

Hot 90 days (`EVENT_HOT_DAYS`), cold 1y. Pruning runs from the retention sweep
(`scripts/retention-sweep.ts`) — events older than 1y are deleted, 90d–1y kept cold.

## Replay (R-006)

`fanOut(event, sink)` re-runs plugins + webhooks for any persisted event —
replay from `EventLog` by id for debugging.

## Webhook-out (R-005)

Per-org endpoints (`WebhookEndpoint`): url + secret + event filter. Delivery is
HMAC-signed (`X-Decision-Signature` over `{at}.{body}`), 3 retries with exponential
backoff (5s cap 60s), dead-letter status on `EventLog` after exhaustion.

## Review (R-010)

Quarterly event-schema review — calendar item; compat checks in CI (schema test).
