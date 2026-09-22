# Boards Persistence — versioned definitions, publish lifecycle, sharing (G-phase)

Boards are movable-widget layouts persisted per org. Proof: `lib/core/boards/store.ts`
+ `store.test.ts` (pure parts), route contracts in `tests/routes.test.ts`,
migration `0019_board_persistence`.

## Model

`Board{id, organizationId, ownerId, name, layout[≤50], widgets[≤50], version,
status: draft|published, shareToken?, deletedAt}` + `BoardVersion{boardId,
version, snapshot, note, createdById}` (append-only; revert adds a new
version, never rewrites).

## Row rule

- Manage: owner or any OWNER (`canManageBoard`, tested).
- View: every org member (`board:view`), non-deleted boards.
- Share tokens: public read-only, published boards only, owner identity
  never exposed; rotate issues `brd_<48hex>`, revoke nulls it instantly,
  delete nulls it too. Draft boards refuse rotation (publish first).

## Lifecycle

create (v1 snapshot + `board:created` event) → update (validate widgets via
the catalog gate, version++, layout-diff note, `board:updated`) → publish
(`draft`→`published`) → share (rotate) → revoke → delete (soft, kills the
token). Revert re-applies any snapshot as a new version (`board:reverted`).

Every mutation emits a hash-chained `ontology:board:*` event with actor +
before/after. Validation reuses `validateWidgetBoard` (unknown types, bad
props, 50-widget cap, duplicate ids, dangling filter targets, role
visibility) — an invalid board can never persist.

## API

- `GET/POST /api/boards` — list (newest first, ≤100), create (201).
- `GET/PUT/DELETE /api/boards/[id]` — read, versioned update, soft delete.
- `POST /api/boards/[id]/revert {version}` — rollback via snapshot.
- `POST /api/boards/[id]/publish {status}|{share: rotate|revoke}`.
- `GET /api/boards/shared/[token]` — public safe subset (no ownerId).

All mutating routes: session → org → `board:manage` → JSON guard →
writable check → store (which re-checks ownership) → access log.

## Kill checks

`findStaleBoards` flags draft boards untouched for 90d for removal review.
`boardWidgetTypes` keeps agent/board integrations to known widget keys.

## Chrome: favorites, search, archive, templates, undo, import/export, tour

- Favorites: `isFavorite` on the board (migration `0020`), toggled by
  owners via `POST /api/boards/[id]/favorite`, listed first.
- Search/archive: `GET /api/boards?q=&archived=1` (substring match,
  provider-agnostic — no SQLite-breaking insensitive mode).
- Templates: `ops-overview`, `risk-wall`, `inbox-triage` in
  `lib/core/boards/templates.ts`, each validated through the user gate
  (a template that fails validation fails the suite).
- Undo/redo: `lib/core/boards/history.ts` — bounded (50) layout history,
  Ctrl+Z walks back, new edits clear redo.
- Import/export: `monad-board/1` envelope round-trips byte-identical
  content; foreign envelopes and invalid boards rejected with reasons.
- Tour: five skippable steps (`BOARD_TOUR_STEPS`) telling the board story:
  live canvas → one filter → receipts → governed actions → versioning.
- Canvas interactions (drag/resize) run on the persisted `layout`
  `{id,x,y,w,h}` contract (12-col grid); the grid renderer lands with the
  canvas work — no layout-shape changes required.
- API additions: `/api/boards/[id]/favorite` (POST). All routes in the
  contract test.
