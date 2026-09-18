# Coupling map (E-001) — where freight lives after extraction

Core (`lib/core/`) is pack-free (enforced by `tests/boundaries.test.ts`).
Everything freight-specific lives in `lib/packs/freight/`:

| Area | Freight home | Core counterpart |
|---|---|---|
| Margin engine | `packs/freight/margin/engine.ts` | — (per-pack compute by design) |
| Place normalization + seed aliases | `packs/freight/margin/places.ts` | `core/answers/service.getAliases` (takes seed as param) |
| Attribution rules R-* | `packs/freight/margin/rules.ts` | `core/corrections/rules.ts` (generic matchers) |
| Answer wiring | `packs/freight/service.ts` | `core/answers/service.ts` (dates, cache, aliases) |
| Brief builder | `packs/freight/brief/build.ts` | `core/brief/summary.ts` (rank/anomaly primitives) |
| Brief variants | `packs/freight/brief/variants.ts` | summary primitives |
| CSV export | `packs/freight/csv.ts` | — (format-specific) |
| NL config | `packs/freight/nl.ts` | `core/answers/nl.ts` (generic parser) |
| Rule validation lists | `packs/freight/rules-validate.ts` | `core/rules/validate.ts` (generic) |
| Field kinds | `packs/freight/margin/rules.ts` | `core/corrections/rules.ts` (generic ops) |

Shared with all packs (core): ingest pipeline, corrections loop, notifications, billing,
auth, jobs/queue/cache, guards, storage, email, org/pricing/pilots/access, dates, NL parser.
