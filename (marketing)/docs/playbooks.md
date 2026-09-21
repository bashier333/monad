# Playbooks + alerts (R-043–R-049, R-042)

## Alert rules (R-042)

`AlertRule`: margin|cost, op </>, threshold, channel inapp|email, pack-scoped.
`POST /api/answers/action` with "notify me when lane X drops" drafts one (confirm
first). Evaluation runs against the week's groups; in-app alerts land in the bell,
email honors opt-out + unsubscribe.

## Playbooks (R-043)

Multi-step: brief → notify → export. `GET/POST /api/playbooks`,
`GET/POST/DELETE /api/playbooks/[id]`, run with `{dryRun: true}` to preview
effects (R-046). Every run lands in `WorkflowRun` history with per-step results
(R-045); failed steps retry once, then mark partial.

## Templates per pack (R-044)

5 starters: Monday brief + notify, weekly export, studio brief + notify,
month-end export, Friday flash. Create from a starter with `fromStarter` index.

## Permissions (R-047)

Playbooks are org-scoped; creating/running needs `upload:import`, deleting the
same. Schedules are advisory strings (cron-shaped) until the worker runs
repeatables per org — the hourly sweep chain exists in `scripts/worker.ts`.

## Marketplace (R-048)

Refused until 3+ orgs run custom playbooks — share templates by copying JSON.
