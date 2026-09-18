# Staging refresh (P-297)

1. Wipe staging DB; apply all migrations from empty (`prisma migrate deploy`).
2. Seed demo org + industry packs (`/api/demo/seed` × packs).
3. Run E2E script (`docs/runbooks/staging-checks.md`) to green.
4. Refresh monthly or before every pilot demo. Never copy production data to staging —
   use synthetic fixtures only.
