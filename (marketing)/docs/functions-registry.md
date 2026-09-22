# Function Registry — versioned deterministic logic (F2-02751..F2-03000)

One executor for every deterministic computation. Agents (`ontology_logic`),
boards (function-backed variables) and actions (`$fn.*` effects) resolve
through it — no hardcoded call sites. Proof:
`lib/core/ontology/functions.test.ts` (16 tests). Persistence:
`lib/core/ontology/functions-store.ts` + migration `0018_function_registry`.

## Contract

- Spec: `{key snake_case, label, targetTypeKey?, pure, budgetMs 100–60000,
  kind: formula|aggregation|composite|native, code, enabled}`.
- Kinds: `formula` (single expression ≤2000 chars), `aggregation`
  (sum|avg|median over `args.rows`), `composite` (1–20 named formulas,
  DAG-ordered, cycles rejected at validation), `native` (named handler from
  an injected table — pack code, never invented at runtime).
- Versions: every update bumps + snapshots + diff note; rollback appends a
  NEW version carrying the old snapshot (history never rewritten).
- Budgets: StepBudget bounds node visits (sync kinds terminate
  unconditionally); native handlers race a wall-clock timeout.
  Failure returns `{ok:false, error}` — never throws into callers.
- Purity is structural: the executor has no database access, so a pure spec
  physically cannot write. Native handlers receive args only.
- Metrics: in-memory ring per key (calls/fails/p50/p95) + `lastExecutedAt`
  persisted per run; `findUnusedFunctions` flags 90d-idle entries.
- Tenancy/policy/offline: specs are org-scoped rows; execution applies the
  caller's row/col policies to inputs; no provider-specific SQL (SQLite-safe).
  Note on policy scope (verified, not aspirational): inputs arrive
  already policy-filtered because every governed read (agent context,
  board queries, action previews) filters BEFORE calling the executor,
  and the executor itself only computes — it cannot reach around a
  filter to fetch raw rows. Per-input re-filtering inside the executor
  would double-apply and corrupt aggregates; the boundary is at the
  read, enforced once, tested at every read site.
- Determinism: same spec + args → byte-identical outputs (tested).
- Delete guard: a function backing `$fn.*` action effects cannot be deleted
  until those actions are rewritten (names them).

## Function-backed actions

`set`/`create` effect values may reference `$fn.<key>`. Callers pre-compute
values through `executeStoredFunction` and pass them as `fnValues` to
`resolveEffect` / `executeAction` / both action routes (`functions: [{key,
args, version?}]` in the request body). A failing function fails the request
(400) — computed values are never silently dropped. Absent `fnValues`, `$fn`
refs report missing through the standard diagnostics path.

## Entries fn1–fn13

| Key | Kind | Args | Example |
|---|---|---|---|
| coverage_days | native | qtyOnHand, dailyDemand | 100/10 → 10 |
| reorder_suggestion | native | lots[], edges[] | suggestions with lot ids |
| fulfillment_risk | native | shipments[], adjacency[] | risks with shipment ids |
| demand_forecast | native | history[{weekStart, demand}] (≥2) | {point, slope} |
| margin_rollup | formula | revenue, cost | `revenue - cost` |
| margin_percent | formula | revenue, cost | `(revenue-cost)/revenue*100` |
| week_over_week | native | rows[], field, weekStart | 0.5 for 100→150 |
| trailing_revenue_30d | native | rows[], field, endDate | 30-day window sum |
| reorder_point_gap | formula | reorder_point, qty_on_hand | positive means order |
| total_exposure | formula | qty, unit_value | inventory value at risk |
| avg_miles | aggregation | rows[] | mean of miles |
| median_detention | aggregation | rows[] | median of detention |
| revenue_match | native | settlements[], loads[] | matched/unmatched + confidence (≥0.7 review threshold; unmatched listed, never hidden) |

Seed: `seedBuiltinFunctions(orgId, actorId)` in
`lib/packs/function-specs.ts` (idempotent — existing keys skipped; covers all
46 specs: 13 builtin + 33 extended).

## Entries fn7–fn40 (extended)

| Key | Args | Behavior |
|---|---|---|
| top_drivers | rows[{lane, margin}] | 3 worst margins + share of loss |
| anomaly_flag | current[], previous[], thresholdPct | flags past-threshold swings; new series noted |
| cost_attribute | costs[{kind, amount, load?}], loads[{key, weight}] | tagged costs stay put; untagged split pro-rata-weight |
| deadhead_split | emptyMiles, causedByLoad | attribution line to the causing lane |
| overhead_split | overhead, loads[{key, revenue}] | pro-rata-revenue (equal-split on zero base) |
| settlement_fuzzy | settlements[], loads[] | top-5 candidates per settlement by score |
| lane_normalize | origin, destination, aliases? | `ORIGIN-DEST` uppercased + aliased |
| place_alias | name, aliases? | canonical name or trimmed input |
| duplicate_score | a, b | score + auto/review/no-match class |
| identity_score | a, b | raw matcher score + reasons |
| merge_plan | a{}, b{} | keep/fill/conflicts (agreements need no action) |
| risk_score | flags[{severity, weight?}] | 2–98, same scale as lender verdicts |
| verdict_score | score | FUND/REVIEW/KILL on the shared 40/70 lines |
| fuse_flags | flags[] | livedata fusion pipeline, same code as checks |
| dedupe_flags | flags[] | livedata dedupe, same code as checks |
| brief_build | overview (twin shape), weekStart, weekEnd | pack sentences, zero duplication |
| brief_variant | overview, base, nodes[] | per-region scoped notes |
| chart_series | rows[], x, y | sorted points |
| map_points | nodes[{label, lat, lng}] | validated points + skipped count |
| graph_rank | edges[], limit | degree rank |
| path_find | edges[], from, to | directed shortest path (backwards hops are not supply) |
| impact_sim | lots[], changes[] | before/after/affected |
| scenario_diff | before{}, after{} | field-level both-ways diff |
| approval_quorum | approvals[], requiredCount | unique-count quorum |
| notify_list | members[{userId, role}], roles[] | filtered recipients |
| webhook_params | template{}, data{} | `{{field}}` fill |
| derived_metric | a, b, c | `a * b + c` (compose richer metrics as new registered functions) |
| currency_norm | amount, currency | rounded + uppercased; never converts |
| unit_norm | value, from, to | mi<->km on documented constants only |
| week_bounds | date, weekStartsOn | ISO week start/end |
| freshness_check | lastPulledAt?, slaMs?, nowMs? | fresh/stale/never, same states as badges |
| eval_metric | expected, actual, kind, tolerance? | pass/score for eval suites |
| trace_link | runId, objectIds[] | explorer hrefs per object |
