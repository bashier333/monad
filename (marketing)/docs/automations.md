# Automations — triggers, effects, guards, history (H-phase)

One runtime for scheduled, conditional and manual operational work.
Proof: `lib/core/automations/automations.test.ts` (spec + dispatch),
`tick.test.ts` (scheduling + conditions end to end), migration
`0021_automation`, contract routes in `tests/routes.test.ts`.

## Spec

`{key snake_case, name, trigger, effects[1..10], maxRetries 0–10,
backoff: constant|exponential, paused, mutedUntilMs?, expiresAtMs?,
throttlePerHour?, dependsOn[], enabled}`. Triggers: `schedule {cron
5-field}`, `condition {field, op: eq|neq|contains|gte|lte, value}`,
`manual` (never auto-fires). Effects: `action {actionKey, objectId?}`,
`function {functionKey, functionArgs?}`, `notify {message, href?}`,
`fallback {message}`. Rules: ≥1 non-fallback effect; action/function
effects name their target; crons have 5 fields.

## Safety properties (tested, no exceptions)

- Explicit targets: automation actions carry `objectId`. The production
  runner refuses targetless writes — automations never pick an arbitrary
  object.
- Guards re-checked at fire time: paused, muted, expired or throttled
  automations return `skipped`, even if the scheduler misfires.
- Dependencies topologically order shared-state work; cycles hard-error
  naming the loop.
- Fallbacks run only when a primary fails; status is ok/partial/failed/
  skipped, never inflated.
- Effect failures are captured per effect with reasons; throwing runners
  cannot escape the drain.

## Runtime

`fireAutomation` dispatches through injected runners (test seam).
Production runners (`scripts/automation-wiring.ts`): actions via the
governed `executeAction` (approvals, webhooks, audit apply identically),
functions via the registry executor with pack handlers, notifications via
`notifyOrg`. Every run records `EventLog automation.fired` + touches
`lastFiredAt`; history reads newest-first (`GET /api/automations?history=1`).

The worker tick (`runAutomationTickForOrg`, every 15 min beside the
playbook tick): schedule-kind fires on `cronMatch`; condition-kind scans
(up to 2000 objects) and fires once with matched rows in args; manuals
only fire through `POST /api/automations/[key]` (same governed path).

## Retries, mute, expiry, throttle

Backoff: constant 30s or exponential 30s·2ⁿ capped at 10 min
(`retryDelayMs`, tested). Mute/pause/expiry evaluated against the tick
clock; throttle counts the trailing hour (`throttleAllows`, tested).
`PATCH /api/automations/[key] {paused}` pauses/resumes with audit events.

## Permissions

Mutations require `board:manage` (OWNER/DISPATCHER — operators run ops;
revisit tighter when automation-specific roles land); reads require
`answer:view`. Definitions validate before persist; duplicate keys
rejected; unknown keys 404. Org scoping enforced on every query
(security-audit gate).
