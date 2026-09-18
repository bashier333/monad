# Monday 7am brief delivery runbook (E-280, both packs)

## Current state

Generation is owner-triggered via the “Generate this week's brief” button
(`POST /api/briefs/generate`, session auth, `upload:import` capability).
There is deliberately no unattended cron yet: the route has no service-token
auth, and per-org fan-out needs an operator to confirm the pilot list first.

## What runs (per pack)

`POST /api/briefs/generate` with `{ "pack": "freight" }` or `{ "pack": "agency" }`.
Generation is idempotent per org + week + pack (upsert). Email fans out to members
unless opted out; every mail carries List-Unsubscribe.

## Manual Monday procedure (until cron lands)

1. Open `/briefs` (fleet) and `/briefs?pack=agency` (studio), generate each.
2. Confirm both briefs render paragraphs with this week's numbers.
3. Check `emailedTo` counts on the returned payload match the member list.
4. If a pack has no data, skip it — do not send an empty brief.

## Cron readiness checklist (do before automating)

- [ ] Service-token auth on the generate route (per-org loop, not per-user).
- [ ] Single-instance guard (upsert already keeps one brief; mail resend needs the guard).
- [ ] Anomaly alerts stay opt-in (`anomalyEmail` / `agencyAnomalyEmail`).

## Failure drill

1. Missing week in the briefs list = failed run; re-run by hand with
   `{ "week": "YYYY-MM-DD", "pack": "<pack>" }`.
2. Resend is safe: same content, `emailedTo` overwritten with the new send list.
