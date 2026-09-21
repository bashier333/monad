# Ontology modeling guide

Live object types replace the old `FREIGHT_ONTOLOGY` / `AGENCY_ONTOLOGY` constants (see Track 10 migration). Model in the Studio or via `POST /api/ontology/types`.

## Rules

- Keys are `snake_case`, 2–64 chars. `id`, `orgid`, timestamps, `type`, `version` are reserved.
- 20 property kinds live in `lib/core/ontology/kinds.ts`. `computed` is read-only.
- Links declare cardinality (`one-one`, `one-many`, `many-many`); self-links auto-create an inverse.
- Every edit bumps the type version, snapshots JSON, and records a diff + migration plan. Destructive steps (kind change, drop) are flagged before they run.
- Only OWNER can manage ontology (`ontology:manage`). All mutations write an access log entry.

## Anti-patterns

- Storing money without a currency-aware kind; use `currency`.
- `text` blobs you need to filter; prefer short `string` + `indexed`.
- Links without a cardinality decision; the default question is "can the far side repeat?"
- Renaming keys instead of labels; keys are API, labels are display.
- Skipping the migration dry-run on kind changes.

## Migration path (Track 10)

- `lib/packs/ontology-live.ts` reads live types first and falls back to pack constants. Live reads stay off unless `ONTOLOGY_LIVE=1`.
- `modelsEqual` proves parity between a seeded live model and its constant. Zero diffs required before cutover.
- Cutover order: seed via `seedPackConstants` → replay fixtures old vs new → set `ONTOLOGY_LIVE=1` → remove constants last.
- `prisma db push` needs an operator: the live database carries pre-existing drift (Brief/MeterEvent pack columns) unrelated to ontology tables. Never `--accept-data-loss` blindly.

## Rollout status (Track 12)

- 525/525 tests green, typecheck clean, eslint clean, all ontology routes and Studio pages verified live.
- Studio: `/ontology`, `/ontology/[key]`, `/ontology/explore`, `/ontology/actions`.
