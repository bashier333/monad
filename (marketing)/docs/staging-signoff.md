# Staging sign-off checklist per pack release (X9 E-450)

Run in order; any ✗ blocks release.

1. `npx prisma migrate status` — chain clean, no pending drift.
2. `npm run test && npm run typecheck && npm run lint && npm run build` — all green.
3. `npm run tenancy` — PASS (org isolation incl. pack namespaces, shares, briefs).
4. `PACK=freight npx tsx scripts/e2e-pack.ts` then `PACK=agency ...` — ALL GREEN.
5. `npx tsx scripts/staging-perf.ts` — all verdicts within budget.
6. `npm run perf:shapes` — freight + agency engines within 2000ms.
7. k6 (needs browser SESSION): `k6 run -e BASE=... -e SESSION=... k6/soak.js`
   and repeat with `-e PACK=agency`; same for spike/recompute.
8. Upload each pack's messy fixture; confirm quarantine codes match the glossary.
9. Generate + email both packs' briefs to a test org; confirm links carry pack.
10. Chaos drill (E-449, manual): kill the worker mid-import per pack path —
    run resets to PENDING within 30 min via the stale-run sweep, no partial answers.
11. Backup/restore: shared tables cover all packs (no pack tables exist) — restore
    to a scratch DB and spot-check counts.
