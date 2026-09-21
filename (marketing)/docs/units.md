# Units (P-113–P-116)

v1: USD + miles, everywhere. Constants: `CURRENCY`, `DISTANCE_UNIT` in `lib/margin/engine.ts`,
shown on every answer header. No silent assumptions: the export header carries both.

## Audit (P-115)

Every money figure renders with `$` + 2 decimals; every distance is labeled miles.
Verified by inspection 2026-09-18 across answers, lane, brief, export, share surfaces.

## Conversion stub (P-116, post-beta)

1. Carry a `currency` column from ingest (no conversion yet).
2. Add a rates table + as-of date per answer.
3. Convert at read time, show both original and converted.
Do not convert at ingest — it destroys the trail.
