# Connector: Excel upload (`xlsx-upload`)

- Kind: file
- Auth: none (server secret store only; zero values in repo)
- Rate budget: 60/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 24h (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

First non-empty sheet wins. Same mapping/validation path as CSV; binary payloads are base64-encoded in transit.
