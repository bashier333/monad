# Connector: Postgres CDC bridge (`postgres-cdc`)

- Kind: rest
- Auth: endpoint or PG_CDC_BRIDGE_URL (server secret store only; zero values in repo)
- Rate budget: 300/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 24h (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

BRIDGE CONTRACT: operator runs a small HTTP service over logical-decoding output returning `{rows:[{_key,_date,table,op,...}], nextCursor}`. No native pg driver is bundled by design (exe stays dependency-light).
