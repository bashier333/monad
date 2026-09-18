# Attribution cookbook (P-119/P-120) — worked examples per rule

Engine: `lib/margin/engine.ts`. Every example below is pinned by a test in
`lib/margin/engine.test.ts` or `properties.test.ts`.

## R-rev-1 — revenue from the TMS record

Load 4821, revenue "1850.00" → lane revenue includes exactly 1850.00. Missing revenue
quarantines at ingest (REQUIRED), so the engine never sees blanks.

## R-det-1 — detention to its load

Load 4822, detention "150" → cost line `detention $150.00` on 4822 only. Move or exclude it
with a correction (`corr:` rule id replaces the rule id on the moved line).

## R-fee-1 — broker fees matched by load ID

Broker file `LoadRef 4821 → FactorFee 55.50` attaches $55.50 to load 4821. Unmatched fee rows
are listed, never hidden: they appear in import review as staged rows with no lane.

## R-fuel-1 — fuel split by miles per truck per week

Truck Unit12 burns $732.30 across loads of 242 + 431 mi → $263.32 + $468.98 (sums exact).
Zero total miles → equal split. Fuel dated outside the week is ignored.

## R-scope-1 — overhead excluded

Margins are contribution margins. Say so on every surface; never imply fully-loaded cost.
