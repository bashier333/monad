# Pack system overview (X7 E-308/E-345)

## Core vs pack

Core (`lib/core/`) owns: ingest pipeline, corrections, brief math, answers plumbing,
share/billing/auth, UI primitives. Core never imports a pack (boundary test enforces).

A pack owns: ontology (entities/measures/rules), field + alias tables, presets,
fixtures + evals, vocabulary, demo seeds, docs. Packs register adapters + manifests
at boot (`lib/packs/register.ts`); unknown declarations throw before serving traffic.

## Refuse list (applies to every pack)

No pack-specific integrations, no custom automation per buyer, no white-label,
no per-client reports, no API connectors in v1 (CSV exports only).

## Expansion test (E-346)

“Would freight use it?” If yes, it belongs in core. If no, it belongs in the pack
— or it gets refused.

## Registry

`GET /api/packs` lists id, name, version, entities, vocabulary + enabled state.
`packEnabled(settings, pack)` gates the answer APIs (403 when disabled); unset means
all enabled. Unknown packs/sources are rejected (400/403), never defaulted (E-304).

## Isolation guarantees (E-350)

- Org scoping on every query (tenancy-check proves it on staging).
- Packs share tables but namespace by sourceType/pack: shares carry `pack`,
  briefs upsert per org + week + pack, answers filter by pack sourceTypes.
- Share links render groups only, never revision/load detail, and expire in 30 days.
- Demo seeds are checksum-idempotent and filename-prefixed `sample-`; graduation
  drops sample rows but keeps mappings.

## Onboarding per pack (E-347)

Upload page = onboarding hub: pack-choice cards → size question (fleet/team) →
checklist (upload → map → answer → correct) → 5-step tour (dismiss persists) →
sample week (one click) → graduate to real.

## Demo flows per pack (E-323/E-327/E-348)

- `POST /api/demo/seed?pack=<pack>`: default/reefer/flatbed/dryvan/agency-video/agency-design.
- Skips already-loaded checksums (`{skipped:true}`); filenames prefixed `sample-`.
- Graduate (`POST /api/demo/graduate`) drops sample rows, keeps mappings.
- Reset is slug-confirmed wipe. Demo-to-paid preserves everything (same org, same rows).

## Settings reference per pack (E-336)

Shared: `weekStartsOn`, `timezone`, `fleetSize`.
Agency namespaced: `agencyWeekStartsOn`, `agencyAnomalyThresholdPts`,
`agencyAnomalyOverrides`, `agencyAnomalySuppressed`, `agencyAnomalyEmail`, `teamSize`.
Cross-pack: `enabledPacks` (owner-only, at least one). All changes validate ranges
and apply instantly (answers rebuild on next request; caches bust on import).
