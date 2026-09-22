# Connector: SEC EDGAR filings (`edgar`)

- Kind: livedata
- Auth: SEC_CONTACT user-agent (server secret store only; zero values in repo)
- Rate budget: 30/min; 429 pauses the schedule 60s, re-pull then SKIPs honestly
- Freshness SLA: 7d (older shows STALE badge)
- Mapping: persists per org; review UI correction becomes the default
- Ledger: every pull writes a SyncRun row, listed in /sync (last 20)
- Deletes: full-set clean pulls tombstone vanished keys; facts are never hard-deleted

## Notes

CIK match + 10-K/10-Q/8-K distress scan per watchlist company. Polite UA required.
