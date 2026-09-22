# Changelog

All notable changes to Monad are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-09-21

- Foundry connectors now write directly into ontology types with validation and audit
- Foundry listed under Our Software with Use in Ontology
- Windows download now serves 1.4.0

---

## [Unreleased]

### Added — Foundry program (connectors → boards → automations → evals)

- Connector framework: 15 typed connectors (CSV/XLSX, paginated REST,
  webhook inbox, Postgres/SQLite bridges, 4 livedata watchlists, TMS,
  fuel cards, broker email, ELD pings, manual forms) with retry budgets,
  per-page cursors, SyncRun ledger (`/sync`), PII scrubbing, tombstone
  deletes, and kill-resume. Migrations `0017`.
- Ontology hardening: unique + immutable property enforcement, type
  revert, unused-type/link scans, link update/delete with edge guards,
  hash-chained mutation events, `listTypes` cap.
- Function registry: versioned formula/aggregation/composite/native
  functions (46 specs) with budgets, metrics, board variables, `$fn.*`
  action backing, and agent `ontology_logic` fallback. Migration `0018`.
- Boards: versioned definitions with draft/publish lifecycle, revocable
  share links, favorites, search/archive, templates, undo/redo,
  import/export envelope, 70-widget typed catalog, selection bus, filter
  engine, action-form derivation, board-scoped agent queries, embed
  guard. Migration `0019` (+`0020` favorites).
- Automations: schedule/condition/manual triggers, action/function/
  notify/fallback effects with retries, mute/pause/expiry/throttle,
  dependency ordering, worker tick, manual fire + history APIs.
  Migration `0021`.
- Eval suites: exact/tolerance/contains/groundedness/llm judges,
  variance protocol, model/version comparison, ontology-edit scoring,
  release rule, quarantine manager, latency/cost capture, sampling,
  human labels, review queue, dashboard rollup, EventLog history.
- Security: JSON-guard on all body routes, audit trail on previews,
  webhook egress allowlist (fail-closed in production), incident
  1-pager, DPA checklist template, SOC2-tail verifications.
- Reliability: root + global error boundaries, offline intent queue,
  auto-execution gate surfaced on previews.

---

## [1.3.2] - 2026-09-21

- Ontology Studio guides: Types, Links, Actions docs wired into the page

---

## [1.3.1] - 2026-09-21

- A cleaner, calmer interface with a new blue accent and dashboard cards.
- Smoother motion throughout, with reduced-motion support for those who need it.
- Sign in with GitHub, plus a branded sign-in page.

---

## [1.3.0] - 2026-09-21

- Simpler navigation: five destinations up top, everything else under More, with a command palette and keyboard shortcuts.
- Answers now show week-over-week changes and every spotlight view, with one-click upgrade when you hit free limits.
- Uploads start with drag-and-drop, mapping confirms straight into answers, and flags, briefs, and shares all got faster.
- The operations console leveled up: searchable explorer with object drawers, safe-retries on actions, an auditable approval inbox, and a scenario A/B table.
- Pricing with annual billing and coupons, a past-due banner that links straight to retry, and share links that sell the product.
- Every async surface has a proper loading state, and the whole app passed its quality gates.

---

## [1.2.0] - 2026-09-21

- Live AI answers from your own data in the automation console — a human still confirms every action.
- A first-run tour, an interactive model map, a beginner's help guide, and plainer wording on every screen.
- Dark mode contrast fixed across the workspace.
- In-app updates: the desktop app checks for new versions and installs on your say-so.

---

## [1.1.1] - 2026-09-21

- Fixes an installer bug where fresh installs would not start.

---

## [1.1.0] - 2026-09-21

- The operations console: digital twin, AI assistant with human-confirmed actions, approvals inbox, audit trail, scenarios, and ops boards.
- A desktop app for Windows with dark mode, command palette, and a zero-setup local database.
- A governed engine: approvals, audit checkpoints, and portable model exports.
- A guided Windows installer that sets everything up in minutes.

---

## [0.12.0] - 2026-09-18

- Pilot checklist, pilot tracking page, landing page, and pricing.

---

## [0.11.0] - 2026-09-18

- Pilot kit: agreement, call agenda, exit interview, and review docs.

---

## [0.10.0] - 2026-09-18

- Admin dashboard, support and known-issues pages, rate limiting, and access logs.

---

## [0.9.0] - 2026-09-18

- Stronger automated testing, messy-data handling, and pilot reliability docs.

---

## [0.8.0] - 2026-09-18

- Team billing: checkout, self-serve portal, free-tier limits, and usage metering.

---

## [0.7.0] - 2026-09-18

- Onboarding checklist, one-click sample data, settings, invites, and full data export.

---

## [0.6.0] - 2026-09-18

- Monday briefs with anomaly highlights, change diffs, feedback voting, and email delivery.

---

## [0.5.0] - 2026-09-18

- Corrections loop: flag a figure, review the queue, turn repeat fixes into standing rules.

---

## [0.4.0] - 2026-09-18

- Answers pages: lane table, drill-downs with source links, CSV export, share links, plain-English questions.

---

## [0.3.0] - 2026-09-18

- Margin engine: lane normalization, attribution rules, and exact rollups.

---

## [0.2.0] - 2026-09-18

- Upload messy exports: column auto-detect, mapping review, and duplicate handling.

---

## [0.1.0] - 2026-09-17

- Foundations: sign-in, organizations, roles, health checks, and sample data.
