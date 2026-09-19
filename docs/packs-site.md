# Packs site docs (X10 E-495–E-500)

## One page per pack (E-495)

- Freight: `lib/packs/freight/README.md` (ontology, rules, sources, vocabulary).
- Studio: `lib/packs/agency/README.md` (same shape, buyer words).

## Buyer comparison (E-496)

Run trucks? → Freight pack (lane margins from TMS/fuel/broker files).
Run a video/design studio? → Studio pack (project margins from time/revision/invoice exports).
Both: upload → mapping → answers → corrections → Monday brief. Packs never mix data.

## Migration guide (E-497)

Switching packs is a choice, not a migration: enable both, upload each pack's
files, compare answers. Namespaced throughout (shares, briefs, metering carry pack).
Disabling a pack hides its answers; data is kept until you delete the org.

Benchmarks are lost on exit (E-745, stated honestly): cross-org percentiles and
"you vs median" context stop the day you leave. Your rows, trail, and exports
leave with you — the comparison context doesn't.

## API docs per pack (E-498)

- Freight: `GET /api/answers/lane-margins?week=`, `GET /api/answers/lane?lane=&week=`.
- Studio: `GET /api/answers/project-margins?week=`, `GET /api/answers/project?...` (page).
- Shared: export (`?pack=`), share (pack in body), recompute (`pack` in body),
  briefs generate/variant (`pack`), rules (pack-validated), packs list (`GET /api/packs`).
- Errors: `{error}` + requestId header; invalid period → 400 with format example.

## Changelog process (E-499)

Per-pack entries under one changelog: pack id, what changed, fixture proof.
Brief content schema v1 — bump only with a migration note in both manifests.

## Strategy memo review (E-500)

This plan (`packs-500.md`) is reviewed quarterly: update numbers or kill it.
No pack #3 without a pack #2 conversion.
