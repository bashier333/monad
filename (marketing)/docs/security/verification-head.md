# Security Verification — head topics (markings → incident)

Verified against code on 2026-09-21. Each control names its enforcement
point; gaps found in this pass were closed (egress allowlist) or filed
with owners (DPA counsel review).

- Markings: deny-by-default row policies (`policies.ts` allow/deny,
  deny-overrides, priority-ordered with full trace) + manufacturing
  marking clearance + sensitive-field masking (`service.ts`
  visibility pass). Unknown clearance defaults to least privilege.
- Provenance: hash-chained `OntoEvent` audit (prevHash-anchored,
  serializable OCC retries, checkpoint anchors) + per-proposal lineage
  on agent actions. Every write names its actor and before/after.
- Row policies: field dot-path ops (eq/neq/in/contains/startsWith),
  skip-on-error, `filterRows` returns [] when no policy applies.
- Column policies: field-scoped policies ARE the column control, plus
  `maskPii` redaction and per-kind PII scrubbing at ingest (tested).
- Purpose limits: enforced through markings + roles + per-action approval
  policies. Dedicated purpose tags deferred — documented, not silent.
- SSO attrs: Auth.js SSO attributes flow into policy evaluation context;
  see auth-policy docs. Group→role mapping reviewed per org.
- Webhook allowlist: IMPLEMENTED this pass (`checkEgressAllowed` +
  `egressPolicy` in webhooks.ts). Exact/subdomain matching, loopback
  policy, fail-closed in production, permissive in dev/test. Enforced on
  every delivery before posting (zero-fetch on deny, tested) + env keys
  in `.env.example` + secrets inventory. Prior state was demo-grade
  (any http/https incl. localhost) — closed.
- Secret store: all keys server-side env only; `.env.example` carries zero
  values (S-623 tested); connector/webhook/LLM keys named, never logged.
- Sessions: Auth.js database sessions with expiry + password reset +
  machine-provisioned desktop sessions (365d, random 32B, logged).
- API keys: hashed storage, prefix display, scopes, tiers, revocation,
  last-used tracking (`apikeys.ts`, tested).
- DPA: template checklist + subprocessor outline written
  (`security/dpa-checklist.md`) — LABELED template, counsel review
  required before first signature. Never presented as legal advice.
- Regions: default + pinning path documented in the DPA checklist;
  verify bucket + DB region at go-live.
- Retention sweep: `scripts/retention-sweep.ts` (report-first default) +
  90-day canceled-state rule + per-org delete-everything.
- Access logs: every data read/write with user + timestamp, 1-year
  retention, queryable for incidents.
- Incident: 1-pager written (`security/incident-response.md`) — contain
  (revoke first), assess (two signals), communicate (<4h beta SLA),
  recover (verified restore), postmortem in 48h with a regression fixture.

## Tail topics (soc2 → export)

- soc2-path: readiness checklist open (`security/soc2-path.md`) — no
  premature certification, path known with auditor/framework target.
- rate-tiers: per-key tiers (`KEY_TIERS` in apikeys.ts, unknown tier
  falls back to standard) + per-route token-bucket limits (tested) +
  k6 probes for 429 behavior.
- log-governance: `logAccess` swallows transport errors (audit never
  breaks the write path); access logs retained 1 year and queryable for
  incidents; markings govern log visibility like any other data.
- export-control: every export/share endpoint session-gated and
  org-scoped; share tokens expire, revoke instantly, and never expose
  owner identity (verified in the route audit).
