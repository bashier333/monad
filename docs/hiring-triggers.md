# First-hire triggers + handoffs (X10 E-491–E-494)

## Triggers (E-491)

- 10 paying teams → backend hire (imports + answers load).
- 25 paying teams → support hire (mapping + quarantine triage).
- Anomaly precision <70% for 2 weeks → data hire before any feature hire.

## Handoff packages (E-492)

- Sales: discovery-kit + objection snippets + pricing page source.
- Support: quarantine glossary + import runbook + staging-signoff doc.
- Eng: core map (`docs/core.md`), pack map (`docs/pack-authoring.md`), boundary test.

## First-engineer onboarding (E-493)

Day 1: run suite + seed demo + upload a messy fixture. Day 2: add one alias +
one rule, watch answers re-run. Day 3: ship a preset. Read the boundary test
before touching `lib/core`.

## Access provisioning (E-494, least privilege)

- No production DB write for support (read-only staging mirror).
- Stripe: support role, no refunds without owner.
- Rotate session + cron secrets on every offboarding.
