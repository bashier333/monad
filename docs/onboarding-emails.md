# Onboarding emails (R-457) + stall detection (R-455) + aha tracking (R-454)

## Day 0/3/7 (value-led, Resend-or-log)

- Day 0: "Your first answer in under a day" — upload link + sample week.
- Day 3: "Your worst lane/project this week" — only if data exists; else mapping help.
- Day 7: "Your Monday brief is ready" — brief link + unsubscribe in every mail.

Templates live in `lib/core/onboarding-emails.ts`; sending rides the existing
`sendEmail` path (Resend or log). Scheduling: worker repeatable (daily sweep of
orgs by age) — wire when the worker runs repeatables.

## Stall detection (R-455)

Stuck = import PENDING/PROCESSING >10 min with no completed run. The upload page
shows "Stuck? Read the import runbook" next to stale runs (stale-run sweep already
resets them). No fake concierge chat — a link to real help.

## Aha instrumentation (R-454)

First answer <1 day is stamped per org (`stampFirstAnswer`) and reported in admin.
Funnel: signup → upload → first answer → first correction → brief (checklist states).
