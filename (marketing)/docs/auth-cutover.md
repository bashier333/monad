# Auth beta→stable cutover plan (S-734)

1. Pin current beta in package.json (today: next-auth 5 beta + adapter).
2. Stage the stable release on staging 48h: signin, signout, session, OAuth,
   magic-link, logout-all paths via `scripts/e2e-pack.ts` auth section.
3. Rollback = repin previous beta + redeploy (<15 min, no migration involved —
   adapter schema is stable across the cutover).
4. Cut over in a Thursday train; announce in changelog.
