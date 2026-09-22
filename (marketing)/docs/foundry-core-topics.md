# Foundry Core Topics — verification record (F2-01001..F2-02000)

Each topic below was verified against code on 2026-09-21. Executed proof:
`lib/core/ontology/foundry-topics.test.ts` (18 tests over versions, identity,
schema, builder, graph, search). DB-backed paths verified by inspection +
route contract tests (`tests/routes.test.ts`).

## Link-types tail (F2-01001..F2-01010)

- Search/empty/error/docs/fixture/offline/telemetry: links list from
  `GET /api/ontology/links` (auth-scoped, ordered); empty renders EmptyState;
  failures use the shared error-copy doc; fixtures via pack seeds;
  provider-agnostic queries (SQLite-safe); mutations write access-log entries.
- Notification/rollback: every link mutation emits a hash-chained
  `ontology:link:*` event (`registry.ts`) — the subscriber substrate;
  `revertLink` rolls back via the last `link:updated` before-image.
- Kill check: `findUnusedLinks` lists links with zero edges.

## Type versions / migration / diff (F2-01011..F2-01070)

- Every `updateType` bumps version, snapshots JSON, records
  `+added -removed ~changed` diff notes (`registry.ts:63-144`).
- `diffTypeSnapshots` detects added/removed/changed incl. flag + config
  changes; `planMigration` marks kind-changes and drops destructive (tested).
- `revertTypeVersion` re-applies any snapshot (itself versioned + audited).

## Identity / cardinality / keys (F2-01071..F2-01160)

- `normalizeKey`/`normalizeName` deterministic; `scoreMatch` exact/near/none
  with reasons; thresholds auto 0.92 / review 0.7 (`identity.ts`, tested).
- `checkCardinality` blocks second target on one-one; one-many/many-many pass;
  enforced at write with OCC retry (`edges.ts:18-27`, tested pure part).
- `KEY_RE` snake_case 2–64 enforced on types, properties and links; 8 reserved
  keys rejected case-insensitively; 200-property cap; dup keys rejected
  (`schema.ts`, tested).
- Label-vs-key: keys are API (immutable after creation), labels are display
  (freely relabeled, `relabel` migration op, non-destructive).

## Templates (F2-01221..F2-01370)

- Shipped: crm, inventory, fleet, projects — all build cleanly through the
  same `validateTypeInput` gate as hand-written types (tested).
- Custom templates: `defineType`/`defineLink` compose caller-defined types
  through the identical validation gate; invalid input throws with field
  errors (tested).
- Type deprecation: `deprecateType` stamps status + timestamp + audit event;
  unknown keys rejected (registry.ts:146).

## Links: inverse / self-links (F2-01401..F2-01460)

- Inverse auto-created (`<to>_of_<from>`; self-links get `<key>_of`).
- Self-links allowed and validated like any link (tested).
- Link changes are transactional delete+recreate under the same key with
  before/after on the audit chain (`updateLink`); deletion blocked while
  edges reference the key, naming the count (`deleteLink`, route DELETE
  flows through it with 404/409 mapping).

## Migration plans / snapshot diffs / Studio (F2-01461..F2-01550)

- Plans render per-step op + detail + destructive flag; destructive steps
  require explicit confirmation (Studio surfaces `plan` from updateType).
- Snapshots browsable per version with revert one-click (`revertTypeVersion`).
- Studio type page lists types + properties + links with JSON/LinkML/SHACL
  export; version history visible.

## Query paths (F2-01551..F2-02000, first 15 topics)

- Objects create/upsert: required + coerce + unique + immutable enforced
  (`objects.ts`); merge-never-clobber on update; duplicate keys rejected.
- Objects list: take clamped 1–200 with keyset cursors; deleted excluded.
- Natural keys: first-string-field derivation, deterministic.
- Edges: OCC cardinality at write; `deleteEdgeInstance` removes precisely.
- Traverse: bfs depth hard-capped at 4, visit cap 2000 with truncation flag,
  in/out/both directions, link-key filter (all tested on adjacency).
- Shortest path, components, suggestions, degree rank (tested).
- Search: key/text/fuzzy with match explanation, type filter, limit clamp,
  2-char minimum (tested).
