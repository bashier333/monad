# Capacity + DB tuning (P-346–P-349, P-359–P-360)

## Per-pilot cost model (P-359, real numbers)

- Storage: sum(DataFile.bytes) per org (see costs API). Fixture-scale pilots: <100MB.
- Compute: one Next instance handles 10 pilots at current query shapes (staging to confirm).
- LLM: $0 until agent features ship — the margin story.
- Postgres: single managed instance to 50 orgs; then read replica (trigger: answers p95 >1.5s).

## Scale triggers (P-360)

- p95 answers >1.5s → read replica → materialized weekly answers.
- Queue depth >50 sustained → dedicated worker dyno/container.
- Storage >500GB → cold-archive runs older than 13 months.
- Hire: backend #2 at 10 paying teams; support at 25.

## DB tuning (P-346–P-349)

- Pool: `connection_limit=10` app-side (see .env.example comment); PgBouncer when pooling
  saturates (log `too many clients` = trigger).
- Slow-query review monthly: `pg_stat_statements`, fix top 5.
- Vacuum/autovacuum defaults OK to 10M staged rows; bloat check quarterly.
- Read replica plan above; no replica before the trigger fires.
