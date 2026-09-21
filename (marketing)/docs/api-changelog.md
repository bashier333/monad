# API changelog (R-029/R-030)

## v2.0.0 — 2026-09-18

- `/api/v2/answers` + `/api/v2/imports`: scoped API-key auth (X-API-Key, rotatable,
  per-key tiers standard 120/min premium 600/min), envelope responses
  (`{data, meta:{requestId, apiVersion}}` / `{error:{code, message, requestId}}`),
  cursor pagination, idempotency-key pattern (`lib/core/apikeys.ts`).
- TS SDK: `lib/sdk/client.ts` (typed, zero-dep). OpenAPI spec: `docs/openapi.json`.
- Key management: `GET/POST/DELETE /api/keys` (owner-only, hashes never shown).

## v1 (session routes) — sunset plan (R-030)

12-month notice from GA. Deprecation headers ship with v2 responses
(`X-API-Version`); v1 routes keep working through the notice window. Migration
path: swap session cookie for API key on server-to-server calls; UI unchanged.

| Version | Date | Notes |
|---|---|---|
| 2.0.0 | 2026-09-18 | Initial v2: keys, envelopes, SDK, OpenAPI |
| 1.x | 2025–2026 | Session routes (current) |
