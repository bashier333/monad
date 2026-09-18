# Changelog

All notable changes to Decision Layer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.12.0] - 2026-09-18

### Pilot Ops
- Pilot checklist model with auto-stamps (first answer, first correction, conversion-on-checkout)
- /pilots page with 3 success criteria + live kill-gate signals + friction-log notes
- Full pilot doc kit: agreement, call agenda, concierge friction log, findings template, exit interview, kill-gate review with SQL

### Landing + Pricing
- Landing page with one promise, demo brief screenshot, honest no-fake-quotes placeholder
- /pricing from single TIERS source of truth with monthly drift-check runbook
- TMS doc system: template + generic guide + 4 vendor stubs

### Offboarding
- Shared deleteOrgData helper, 90-day retention sweep script (report-first default)
- Canceled-state billing panel with export reminder

### Verification
- vitest 118/118, eslint 0 errors, `next build` green (57 routes)

---

## [0.11.0] - 2026-09-18

### Observability & Support
- /admin dashboard: users, uploads, answers, corrections, briefs, plan
- Failures + costs JSON APIs (honest $0 LLM line with revisit trigger)
- /support, /known-issues, /changelog pages
- Alerts runbook with per-signal wiring + test instructions

### Verification
- vitest 117/117, eslint 0 errors

---

## [0.10.0] - 2026-09-18

### Security & Hygiene
- In-memory token-bucket rate limits on auth/uploads/answers + middleware wiring
- AccessLog model (migration 0007) wired into 7 mutating routes
- npm-audit gate in CI, dev secret rotated, encryption checklist
- Incident 1-pager, alerts runbook, SOC 2 path + subprocessor list

### Verification
- vitest 117/117, eslint 0 errors

---

## [0.9.0] - 2026-09-18

### Quality: Tests, Evals, Messy-Data Warfare
- v8 coverage gate (80% lines/functions on pure libs; actual 97.6% lines)
- 37-assertion API contract suite (route surface + per-route auth audit)
- Scan/parse unit tests, 4 adversarial fixtures with expected-behavior tests
- Stale-run sweeper + owner endpoint + chaos runbook
- Pilot SLA + postmortem template + bug template
- Concurrent-load runbook in perf docs

### Verification
- vitest 113/113 with coverage thresholds enforced

---

## [0.8.0] - 2026-09-18

### Billing (Team Tier)
- Subscription + MeterEvent models (migration 0006)
- Stripe checkout/portal/webhook (dunning clock: past_due → read-only at 21d)
- Free-tier enforcement (10 uploads/mo, 90-day history, upgrade messaging)
- Usage metering on upload/answer/recompute/brief + usage API
- Read-only guard on all 11 mutating routes
- Billing panel in /settings, billing rule tests

### Verification
- vitest 64/64, `next build` green

---

## [0.7.0] - 2026-09-18

### Multi-Tenancy, Onboarding, Pilot Readiness
- Staging tenancy-check script + runbook (manual E2E script included)
- Live onboarding checklist on /upload
- One-click sample-week demo seed through the real pipeline
- /settings (org settings incl. anomaly threshold, invites with magic links,
  export-everything JSON, slug-confirmed delete-everything)
- Expanded /help guides

### Verification
- vitest 60/60, `next build` green

---

## [0.6.0] - 2026-09-18

### Weekly Brief + Anomalies (Retention Hook)
- Brief model + org settings + email opt-out (migration 0005)
- Pure brief builder (winners/losers/anomaly detection/new-since diff/template paragraph — no LLM, $0)
- Idempotent generate endpoint (Resend-or-log delivery, HMAC one-click unsubscribe + List-Unsubscribe header)
- Archive + brief pages with feedback voting and print-to-PDF
- Cron runbook

### Verification
- vitest 60/60

---

## [0.5.0] - 2026-09-18

### Corrections Loop (The Moat)
- Correction + StandingRule models (migration 0004)
- Flag dialog on every cost line
- Queue with owner approve/reject
- Rules with live preview
- Alias manager (user-editable aliases apply immediately)
- Bulk revert, re-run-with-corrections + adjustments trail
- Per-figure correction history, correction stats API
- Engine/service refactored to one pure path (getInputs → buildAnswer)

### Verification
- vitest 57/57, `next build` green (32 routes)

---

## [0.4.0] - 2026-09-18

### Answers + The Trail (The Product)
- Shared answer service, /answers (week picker, NL box, totals, rules+trail meta, CSV export, 30-day share links)
- /answers/lane (loads, expandable cost lines with source pins, top-3 drivers, WoW delta, recent imports, fuzzy-lane recovery)
- Public /s/[token]
- NL matcher with 30-case CI eval set
- /help stub

### Verification
- vitest 53/53 (30 NL cases green)

---

## [0.3.0] - 2026-09-18

### Ontology-Lite + Margin Engine
- Place normalization + seed/user aliases (PlaceAlias, migration 0002)
- 5 documented attribution rules
- Deterministic cents-rounded engine
- Lane-margins API
- Perf harness (100k loads → 1817ms, budget 2000ms)

### Verification
- vitest 23/23 (incl. hand-computed cent-exact + determinism tests)

---

## [0.2.0] - 2026-09-18

### Ingest: Upload the Messy Export
- Upload endpoint + file registry + column auto-detect + mapping review UI
- Row validation + duplicate/overlap review + multi-source conflict surfacing
- In-process job runner + 3-file synthetic fixture corpus
- Data policy doc + migration 0001_init

### Verification
- vitest 17/17, `next build` green (12 routes)

---

## [0.1.0] - 2026-09-17

### Foundations
- Stack locked: Next.js 15 + TypeScript + Tailwind v4, Postgres + Prisma 6, Auth.js v5 (beta.32)
- CI pipeline: install → typecheck → unit tests → build
- Env management: .env.example complete, secrets only in host secret store
- Auth wired: signup/login/logout, email + Google, session expiry, password reset
- Org/workspace model: user belongs to org, org owns all data, invite-by-email
- Roles v1: owner, dispatcher (analyst), viewer — server-side enforcement
- DB migrations framework + first migration + rollback tested
- Error tracking + structured logging + request IDs
- Product analytics: signup, upload, answer-viewed, correction-made events
- Uptime monitor + status page stub
- Seed script: demo carrier org with realistic messy data
- Backup + restore runbook

### Verification
- prisma validate, tsc, eslint 0 errors, vitest 3/3, `next build` green
