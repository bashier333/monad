# Connector: TMS export (`tms-export`)

- Kind: file
- Auth: none (server secret store only; zero values in repo)
- Rate budget: 60/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 24h (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

McLeod/TMW-style CSVs. Vendor presets in `lib/core/ingest/presets.ts`; fingerprint-keyed ColumnMapping per org.
