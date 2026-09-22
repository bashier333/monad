# Foundry Ops Runbook — connectors, functions, boards, automations, evals

Who: on-call operator. Where: `/sync`, `/ontology/ops`, worker logs.
Golden rule: reads never break writes; every mutation is audited; when in
doubt, pause (automations), revert (boards/types/functions), resume (sync).

## Connectors (Phase A)

- Ledger: `GET /api/sync/runs?take=20` or `/sync`. Statuses: COMPLETED /
  DEGRADED (degradedSources names the cause) / FAILED (failureReason) /
  SKIPPED (rate pause with resume time).
- Stuck pull: check SyncRun cursor → re-run resumes from cursor (per-page
  persist + upsert). Zero-dupe guarantee via load keys.
- 429 storms: runner pauses the schedule 60s automatically; re-pulls SKIP
  honestly until the pause lifts. Raise `defaultRpm` only after checking
  upstream quotas.
- Bad rows: quarantined with codes (INVALID_DATE, NEGATIVE_VALUE,
  ENCODING), never dropped. Fix source, re-pull.
- Tombstones: full-set clean pulls mark vanished keys `deletedAt`.
  Facts stay readable. To restore: re-pull with the keys present.
- Secrets: env-only. `missing server secrets` error names the key —
  set it in the host store, never in code or chat.

## Functions (Phase D)

- Registry: `OntoFunction` rows + append-only versions. Rollback = new
  version carrying the old snapshot (history never rewritten).
- Budgets: StepBudget (sync) + wall-clock (native). `budget exceeded`
  errors mean raise `budgetMs` (≤60000) or split the composite.
- `$fn.*` failures fail the action request (400) — by design, never
  silently dropped. Check the named function first.
- Unused: `findUnusedFunctions` (90d idle) for removal review.

## Boards (Phase F/G)

- Invalid boards cannot persist (catalog gate). Revert any version;
  publish before sharing; revoke kills links instantly.
- Share 404s: token revoked, board unpublished/deleted, or wrong token —
  in that order.
- Stale drafts: `findStaleBoards` (90d) for removal review.

## Automations (Phase H)

- Status: ok/partial/failed/skipped (+ reason). Skipped = guard held
  (paused/muted/expired/throttled) — usually correct, not broken.
- Failing primary: fallback notify fires; check the effect errors in
  `automation.fired` history (`GET /api/automations?history=1`).
- Pause: `PATCH /api/automations/[key] {paused:true}` (audited).
  Mute: set `mutedUntilMs`. Expired: extends require a new definition.
- Throttled: raise `throttlePerHour` or split the automation.
- Cycles: dependency loops hard-error naming the loop — remove an edge.
- Worker: 15-min tick beside playbooks; `worker: automation tick fired
  N ok runs` in logs. Manual fire: `POST /api/automations/[key]`.

## Evals (Phase I)

- Red suite: read failures (exact diffs, ungrounded ids named), fix the
  function/prompt, re-run. Never lower the threshold to go green.
- Regression vs baseline: `lastGreenBaseline` tells you what changed.
- Flaky: quarantine BY NAME, fix, heal after N green streaks.
- Release: threshold + no regression + zero unquarantined flakes.
  Disagreements (human vs judge) are logged, never averaged away.

## Security incidents

See `security/incident-response.md` (revoke first, two-signal rule,
<4h beta comms, 48h postmortem with regression fixture).

## Deploy checklist (migrations 0017–0021)

1. `prisma migrate deploy` (postgres). Exe: `prisma db push` (sqlite).
2. `prisma generate` (+ sqlite variant) — types must include SyncRun,
   ConnectorState, OntoFunction(+Version), Board(+Version), Automation.
3. Env audit: connector bridge URLs, webhook allowlist (production!),
   LLM keys, UPDATE_FEED_URL.
4. Seed builtins: `seedBuiltinFunctions` + board templates on first boot.
5. Verify: `/api/health` ok, one dry-run pull, one eval suite green.
