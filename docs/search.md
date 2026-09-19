# Search (R-051–R-059)

Global search across records, briefs, corrections, files — always org-scoped,
optionally pack-filtered (`lib/core/search.ts`, `GET /api/search`, `/search` page).

- Typo-tolerant: contains + token Levenshtein ≤2 (R-056).
- Recent searches per user in localStorage (R-054).
- Analytics: in-memory hit/miss counters (`searchStats`) — "searches with no
  results" is the content-gap signal for help docs (R-055/R-497 note).
- Latency budget p95 <300ms: route warns over budget; 5k-row matcher test in CI (R-058).
- No DB trigram index yet (R-052 open): scans are capped (5000/100/500/200) and
  paginated at 50 hits. Add pg_trgm when an org passes 100k staged rows.

Full-text index, quarterly review: calendar items (R-052/R-060).
