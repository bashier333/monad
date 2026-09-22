# Connector: Manual form entries (`manual-form`)

- Kind: manual
- Auth: none (server secret store only; zero values in repo)
- Rate budget: 600/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 30d (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

Hand-entered corrections/notes as JSON lines. SSN/card patterns are redacted before storage (tested).
