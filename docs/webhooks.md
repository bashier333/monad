# Webhooks (R-005 out, R-381–R-390 in)

## Outbound (R-005)

Per-org endpoints (`WebhookEndpoint`): url + secret + event filter. HMAC-signed
(`X-Decision-Signature` over `{at}.{body}`, subtle crypto), 3 retries with backoff
(5s→60s), dead-letter status on `EventLog`. Manage via settings (`hookSources`
maps source → pack); secrets live in org settings, never in logs/UI.

## Inbound (R-381–R-390)

`POST /api/hooks/[orgSlug]` with `X-Hook-Signature` (HMAC over raw body) or
`Bearer <secret>`. Envelope `{source, rows[], idempotencyKey?}` validated —
bad payloads quarantine to `EventLog` status `dead` with attempts 3 (R-382),
nothing imports. Replays protected by idempotency keys (R-383); registry maps
source → pack via `hookSources` (R-384); manual replay at `POST /api/hooks/replay`
(R-385); per-source rate limits in middleware (R-386); signature schemes
HMAC/Bearer (R-390).

## Sync ops (R-398 note)

Sync run history = import runs (rows, duration, errors) + `EventLog` statuses.
Backfills: re-upload the file (checksum dedupe keeps it safe). Staging drills:
`docs/staging-signoff.md`. Health per connection: event counts by status.
