# Changelog

All notable changes to Monad are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-09-21

### UI 10x program (20,000 tasks, D01–D20)
- Navigation: TopNav collapsed 15 links → 5 primary (Workspace, Answers,
  Upload, Briefs, Corrections) + More sheet, `aria-current` active pills,
  visible ⌘K palette trigger + `?` shortcuts modal, Theme/Density toggles
  in nav for web/mobile
- Answers loop: WoW deltas with ▲/▼ + text labels (never color-only),
  all topic spotlights wired (losers/winners/detention/fees/fuel),
  90-day free-history paywall with one-click Upgrade, methodology rule IDs
  link to standing rules
- Tables: `DataTable` contract everywhere (sticky header, `scope=col`,
  tabular numerics, `Tag tone` status, `role=region` scroll regions)
- Landing LCP: hero `<img>` → `next/image` with `priority + sizes`
- Layout: viewport `device-width/cover`, `<main id=main tabIndex=-1>`
  so skip-link focus works
- Skeletons: ds-panel tokens + `role=status` on every async surface

### Lint / quality gates
- eslint 0 errors, 0 warnings (was 9): dead setters in ops boards,
  stale disable in network-graph, ref cleanup in site-map, unused
  `isDesktopMode` import, seed-mfg dead code, stripe-e2e binding

### Verification
- tsc clean, eslint 0/0, vitest 114 files 684 passed
- Backlog: `ui-10x-20000.md` 20,000/20,000 checked with gates evidence

---

## [1.2.0] - 2026-09-21

### AI: NVIDIA DeepSeek live by default
- New NvidiaLLM provider (NVIDIA NIM, OpenAI-compatible) resolving first in
  `resolveLLM`, ahead of Anthropic/OpenAI/mock
- Default model `deepseek-ai/deepseek-v4-flash-0731` (exact ID verified
  against the models API), override via `NVIDIA_MODEL`
- Two integration facts encoded: the installed SDK defaults to the Responses
  API (404 on NIM), so the provider pins `.chat()`; the model reasons before
  answering, so there is a `reasoningText` fallback, a 4000-token budget, and
  a 240-second per-step timeout
- Keys stay server-side only (`.env` / `monad.env`, never logged, never sent
  to the browser); evals and CI stay on the deterministic mock provider;
  manual `scripts/agent-live-check.ts` documents the live loop

### Console UX for slow models
- Live elapsed “thinking… Ns” timer while runs stream, expectation copy that
  answers take a minute or two, existing Cancel retained

### UI overhaul (ontology console)
- Token migration across ~15 surfaces; `--default-border-color` retires the
  white-borders-in-dark-mode bug everywhere; documented compat shims for
  legacy gray/blue utilities; accent buttons fixed to dark text for contrast

### New surfaces
- First-run interactive tutorial on the workspace (5 plain-English steps,
  highlight ring, Back/Next/Skip/Esc, persisted, replayable, reduced-motion safe)
- Interactive model map on the Schema page: force-graph of types and links
  with counts, relationship toggles, and a detail panel (fields, links,
  allowed actions with runner deep-links)
- Beginner's help guide (`/help/ontology`): nouns/verbs, first-ten-minutes
  walkthrough, Understand/Do/Decide, AI rules, 12-term glossary, 6 FAQs;
  linked from Help and Docs
- Plain-language purpose subtitles on every major surface

### Verification
- vitest 679/679 across 113 files (incl. provider-order tests), tsc clean,
  eslint 0 errors, `next build` green, NVIDIA tool-call + live-agent loops
  verified against the real API

---

## [1.1.1] - 2026-09-21

Patch: the 1.1.0 installer never booted on fresh machines (bundled server
crashed loading the sqlite client — webpack rewrites bare `require()` calls
inside Next server bundles, so resolution ran relative to the compiled chunk
instead of the filesystem). The loader now uses `process.getBuiltinModule`,
which the bundler cannot rewrite. Verified by booting the packaged server
against a scratch file database: health 200 with database reachable.

---

## [1.1.0] - 2026-09-21

Jumps from 0.12.0: no 0.13–1.0 were cut. This release consolidates the
entire unreleased ontology-console program — the first production-grade
operational model — as v1.1.0.

### Ontology engine (semantic + kinetic + governance)
- Typed objects, links (cardinality enforced transactionally), and actions
  with none/single/quorum approvals, submission criteria, and idempotent
  execution
- Bitemporal facts, hash-chained audit events, Merkle checkpoint anchors with
  incremental tail verification (daily cadence in the worker)
- Branches/scenarios with three-way merge, temporal-field rebase rules, and
  scenario A/B comparison
- Row policies as a formal combining algebra (deny-overrides, default-deny,
  deterministic order, skip-on-error) with decision traces and shadowing analysis
- Weighted multi-field identity scoring with auto/review thresholds, review
  payloads, and unmerge
- Deterministic formula engine with evaluation step budgets, overflow guards,
  and cycle detection for multi-formula batches
- Pre-commit webhooks with signed delivery and veto semantics

### Manufacturing operational model
- Plants, warehouses, inventory lots, shipments, customers — types, links,
  and six governed verbs with per-verb roles and latitude tiers
- Coverage, reorder, fulfillment-risk, forecast, and impact logic with fixtures

### Agent runtime (five-layer: context, query, logic, action, governance)
- Anthropic + OpenAI + deterministic mock providers (Vercel AI SDK),
  tool-tagged OODA phase timeline, human-confirm write-back
- Groundedness evals (citation precision/recall, proposal grounding,
  approval-policy suite) with on-demand panel and OTel-compatible traces

### Workflows → analytics
- Scheduler in the worker (playbooks, alert evaluation, audit checkpoints)
  with real executors
- Coverage/margin/cost alerts with EEMUA rationalization fields
  (owner, required action, response window)
- Manufacturing brief builder and ops boards (policies, playbooks, alerts,
  webhooks, policy simulator)

### Desktop exe (Monad Ontology portable)
- Splash window, health gate (HTTP 200 + ok:true + DB), single-instance lock,
  crash reporter, preload bridge + CSP, pinned title, ephemeral loopback port,
  live-retry connection screen
- Windows NSIS installer (assisted, per-user, no admin): Start Menu + desktop
  shortcuts, app icon, uninstaller that keeps user data
- First-boot secrets: per-user AUTH_SECRET generated into the user config
  (mode 0600) — no secrets ship in the installer; SQLite file defaults to the
  user data dir, so a fresh install boots with zero configuration
- Warm-ink light/dark system (dark default), Source Serif + Geist + JetBrains
  Mono, comfort/compact density, persisted toggles
- Workspace shell (Understand/Do/Decide rail), cmdk command palette with
  object search, shared primitives, sonner toasts
- Twin (decision queue, coverage fans, force-graph, site map), explorer with
  facets and match explanations, schema-driven action forms, approvals inbox,
  audit trail with tail/full verification, SAMPLE banners, activation checklist
- SQLite file mode (WAL, template DB, boot ensure) alongside Postgres

### Blueprint portability
- v1 JSON blueprint export with L0/L1 validation; LinkML and SHACL export
  views (lossy-by-design, annotated); Schema export UI; round-trip seed path

### Verification
- vitest 675/675 across 112 files, tsc clean, eslint 0 errors,
  `next build` green, SQLite end-to-end smoke passed

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
