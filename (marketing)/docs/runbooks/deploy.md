# Deploy checklist (P-295)

1. `npm run typecheck && npm run lint && npm run test` green locally.
2. Review migration SQL (never edit applied migrations; new change = new migration).
3. Backup staging DB, apply migrations, run staging E2E script.
4. Deploy; watch `/api/health` + error tracker for 15 min.
5. Announce in changelog + pilot channel.

# Rollback checklist (P-296)

1. Redeploy previous green build (CI keeps artifacts per commit).
2. Migrations are forward-only: rolling back code never rolls back schema — new code must
   tolerate the newer schema (additive migrations only).
3. Verify `/api/health`, run smoke (login → answers), announce.
