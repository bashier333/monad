# Connector: CourtListener dockets (`courtlistener`)

- Kind: livedata
- Auth: optional COURTLISTENER_TOKEN (server secret store only; zero values in repo)
- Rate budget: 30/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 7d (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

Same watchlist contract as OpenCorporates. Docket hits become rows with severity + URL.
