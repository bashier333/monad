# Boards Widget Catalog — 70 typed contracts (Phase F source of truth)

Boards render FROM this registry (`lib/core/boards/widgets.ts`); a widget
cannot exist on a board unless defined there with its query contract, props
schema, selection-bus events, roles and perf budget. Enforced by
`lib/core/boards/widgets.test.ts`, which fails if any key below is missing.

Conventions: data widgets subscribe to `selection.set`/`filter.set` and
publish `selection.set`; filters publish `filter.set`; events open
`action.open`; budgets ≤150kB load eagerly, above loads lazily.

## Display

| Key | Data source | Notes |
|---|---|---|
| `object-table` | objects | typeKey required; evidence links per row |
| `object-list` | search | match explanations |
| `object-view` | objects | objectId or current selection |
| `property-list` | objects | key/value + facts |
| `links` | traverse | depth 0–4 |
| `object-set-title` | objects | count + freshness |
| `markdown` | none | operator notes |
| `resource-list` | objects | files/briefs/exports |
| `media-preview` | objects | file metadata |
| `spreadsheet-display` | objects | staged rows + quarantine flags |
| `video-display` | none | linked briefing |
| `audio-transcription` | none | searchable transcript |
| `pdf-viewer` | none | brief PDF |
| `image-annotation` | objects | pinned photo notes |
| `free-form-analysis` | none | analyst scratchpad |
| `data-freshness` | none | per-source STALE badges |
| `edit-history` | events | correction chain |
| `linked-resources` | none | packs/blueprints/docs |
| `action-log-timeline` | events | actors + diffs |
| `iframe` | none | allowlisted embeds |
| `embedded-module` | none | read-only module embed |
| `scenario-manager` | objects | stage/compare/merge |
| `scenario-selector` | objects | active scenario picker |
| `scenario-summary` | measures | before/after KPIs |
| `mobile-navbar` | none | narrow viewports |
| `qr-reader` | none | scan into selection |
| `current-location` | none | geo filter |

## Visualization (lazy, 150–220kB)

| Key | Data source | Notes |
|---|---|---|
| `chart-xy` | measures | bar/line/scatter |
| `vega-chart` | measures | Vega-Lite spec |
| `map` | objects | validated geopoints + popups |
| `gantt-chart` | objects | time + status |
| `pie-chart` | measures | 2–5 slices |
| `stepper` | objects | pipeline stages |
| `metric-card` | measures | eager 60kB; int/money/pct |
| `pivot-table` | measures | row/column dimensions |
| `timeline` | events | time-ordered facts |
| `time-series-analysis` | measures | trailing/WoW/forecast |
| `observability-chart` | events | runs/latency/errors |

## Filtering (all publish `filter.set`)

`filter-list`, `object-dropdown`, `string-selector`, `date-time-picker`,
`text-input`, `numeric-input`, `filter-pills`, `search-bar`,
`prominent-terms`, `user-select`.

## Events (OWNER/DISPATCHER; action widgets require actionKey)

`button-group`, `media-uploader`, `comments`, `tabs`,
`inline-action-form`, `audio-recorder`, `drag-drop`, `app-pairing`,
`commands`.

## AIP (lazy; grounded in board selection)

`aip-analyst`, `aip-chatbot`, `aip-generated-content`.

## System

`layout-grid`, `variable-bar`, `event-inspector`, `version-history`,
`publish-flow`, `permission-pane` (OWNER-only), `performance-profiler`,
`usage-metrics`, `state-saver`, `translations-pane`.

## Runtime (selection bus + filter engine)

Contracts above execute through `lib/core/boards/selection.ts` (bus:
validated publish, revisioned state, pub/sub with unsubscribe; unknown verbs
rejected) and `lib/core/boards/filters.ts` (eq/neq/contains/gte/lte/in;
shorthand normalization; unknown fields reported, never silently dropped).
Proof: `lib/core/boards/selection.test.ts`.

## Event widgets: forms derive from definitions

`button-group` / `inline-action-form` never hand-build forms.
`lib/core/boards/action-forms.ts` derives one field per `$inputs.*`
reference (`describeActionForm`: object pickers for ids, numbers for
quantities, textareas for reasons) and validates submissions before preview
(`validateActionInputs`). `$fn.*` refs are computed, never user fields.

## AIP widgets: questions scoped to board state

`aip-analyst` / `aip-chatbot` / `aip-generated-content` ask through
`lib/core/boards/agent-query.ts`: `buildBoardAgentQuery` scopes the
question to selection + filters + widget types (capped, length-checked),
and `filterAgentContext` narrows retrieved context to the selection —
empty keeps what the board shows, unknown ids select nothing.
Proof: `lib/core/boards/widget-contracts.test.ts`.

## Embed + scenario widgets

`iframe` / `embedded-module` load only allowlisted https origins
(`validateEmbedUrl` in `lib/core/boards/widget-system.ts` — fails closed
with reasons). Scenario widgets stage `BranchChange`-shaped edits,
preview through `impact_sim`, summarize through `scenario_diff`, and
commit through `mergeBranch` — the shapes are proven to line up in
`lib/packs/scenario-flow.test.ts`.
