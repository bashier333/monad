# Migration posture (S-997, S-957 note)

- Migrations are additive-only (ADD COLUMN with defaults, new tables, new indexes).
- `prisma migrate diff` reviewed before every apply.
- Backup before every migration (runbook).
- Rollback = forward fix (no down-migrations kept); destructive changes ship as
  add → backfill → drop across three releases.
- Deploy does not auto-migrate; migrate deploy runs as a separate step so a
  migration failure never takes the deploy with it (and vice versa).
