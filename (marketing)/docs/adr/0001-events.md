# ADR-0001: Event bus over direct calls (2026-09-18)

## Context

Packs need lifecycle hooks (onImport/onAnswer/onCorrect), orgs want webhook-out,
and the audit trail must derive from one source. Direct calls would couple core
to every consumer.

## Decision

`lib/core/events.ts`: versioned domain events persisted to `EventLog`, fanned out
to plugin hooks (sandboxed, 2s timeout, scopes) + HMAC-signed webhooks (3 retries,
dead-letter). Core never imports packs; packs register hooks at boot.

## Consequences

- Audit trail = event log view (immutable, append-only).
- Replay = re-fan-out from the log.
- Retention: hot 90d, cold 1y (retention sweep).
- Plugin review checklist gates new subscribers.
