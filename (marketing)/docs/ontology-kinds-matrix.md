# Ontology Kinds Matrix — verified per-kind reference (Phase B, F2-00451..F2-00950)

Every claim below was verified against code on 2026-09-21. Test proof:
`lib/core/ontology/kinds-matrix.test.ts` (124 tests: coerce, negatives,
config, immutable, unique, search weight, blueprint shape, telemetry, perf).
Enforcement proof: `lib/core/ontology/objects.ts`
(`checkImmutableViolation`, `findUniqueViolations`, required + coerce in
`coerceData`, per-kind telemetry in the write path).

Shared truths (hold for all 20 kinds unless the row says otherwise):

- Coerce: `coerceValue` (`lib/core/ontology/kinds.ts`); empty/null collapse to
  null and are never stored. `computed` is read-only (always rejects).
- Required: enforced in `coerceData` — missing required fails the whole write.
- Unique: enforced on create + update via bounded scan (50k, provider-agnostic
  so SQLite/exe works); duplicate value rejected naming the holder.
- Immutable: enforced on the update path — change rejected, never merged.
- Studio: `app/ontology/model-board.tsx` lists kind + flags; value entry is
  generic with server coerce errors surfaced (`actions/runner.tsx` error path).
- Board: every kind renders from live `search`/`traverse`/`facts` routes.
- Filter: global filter bar operates on coerced values with kind-correct
  operators (equality all kinds; range on number-family + date-family).
- Search: `indexText` (`search-nl.ts`) carries strings, numbers, arrays and
  nested objects — every kind is retrievable by its value.
- Export: `toLinkML` maps all 20 kinds (zero `x-monad-unknown-kind`);
  originals preserved in `x-monad-kind` annotations for our importer.
- Migration: kind change = destructive `alter_property` flagged before run
  (`versions.ts:planMigration`); dry-run required, never `--accept-data-loss`.
- Policy: row/col policies apply to coerced values; masked fields never reach
  agent context or board widgets (`policies.ts`, deny-overrides).
- Agent read: values render as JSON (≤300 chars/node, 400 nodes, 2000-node
  cap with truncation flag, `agent/context.ts:64`).
- Agent write: actions coerce through the same path; bad values fail preview.
- Offline: no provider-specific SQL anywhere in kinds/objects/registry —
  bounded `findMany` only; exe SQLite path tested.
- Telemetry: `kinds-telemetry.ts` meters ok/fail per org+kind on the governed
  write path; `kindErrorRates()` ranks worst-first for Ops review.
- Deprecation: kinds are a closed set (no per-kind retirement); deprecation
  happens at type level (`deprecateType`, `registry.ts:146`) with
  status + timestamp + audit event.
- Perf: 10k mixed-kind coercions << 2s (tested); `listObjects` capped at 200
  with keyset cursors; `listTypes` capped at 500.

Per-kind notes (only what differs from the shared truths):

| Kind | Coerce rule | Negative test | Config |
|---|---|---|---|
| string | min/maxLength, pattern | over-max, pattern miss | minLength/maxLength numbers |
| number | numeric strings accepted | "abc"; min/max bounds | min/max |
| boolean | loose: true/"true"/1 | "maybe" | none |
| date | ISO date normalized to YYYY-MM-DD | "nope" | none |
| datetime | full ISO instant | "nope" | none |
| enum | must be in options | "z"; missing options config rejected at type level | options[] required |
| reference | non-empty object id string | empty collapses to null (never stored) | none |
| multi_reference | scalar wraps to 1-array | over maxCount | maxCount |
| geo | lat -90..90, lng -180..180 | out-of-bounds, missing axis | none |
| file | storage pointer string | mime outside allowlist | mimeAllowlist |
| currency | number (minor-unit agnostic, documented at call site) | "abc"; below min | min/max |
| percent | 0–100 clamped by rejection | 101 | none |
| duration | non-negative number (unit documented at call site) | -1 | none |
| phone | 7–24 chars phone alphabet | "x" | none |
| email | RFC-ish regex | "nope" | none |
| url | http(s) required | "not a url" | none |
| json | passthrough (indexable strings/numbers inside) | undefined collapses to null | none |
| computed | always rejects (read-only) | any write attempt | n/a |
| integer | rejects 4.5 | non-integers | none |
| text | long-form string, 5000 default cap | over-max | minLength/maxLength/pattern |

## Registry additions shipped with this matrix

- `listTypes` take cap (default 500, hard max 1000) — perf aspect.
- `revertTypeVersion` — rollback aspect (re-applies a version snapshot,
  itself versioned + audited).
- `findUnusedTypes` — kill-check aspect (types with zero live objects).
- `updateLink` — transactional delete+recreate under the same key with
  before/after on the hash-chained audit log (links carry no version table
  by design; cardinality changes are destructive by nature).
- `deleteLink` — blocked with a named count while edges reference the key
  (route DELETE now flows through it; was unguarded).
- Hash-chained `recordEvent` emissions on type create/update/deprecate and
  link create/update/delete — the notification substrate subscribers build on.
