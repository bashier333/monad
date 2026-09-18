# Canonical schema rationale (P-119)

Entities: Organization → Membership → DataFile → ImportRun → StagedRecord (+errors),
ColumnMapping, PlaceAlias, Correction → StandingRule, AnswerShare, Brief, Subscription,
MeterEvent, AccessLog, PilotChecklist.

## Why these entities

- Staged rows (not loads) are the truth layer: raw + validated, never mutated by answers.
- Loads/lanes are computed, never stored: recompute is free, history can't rot.
- Corrections are first-class rows (not edits): the trail compounds instead of overwriting.
- Standing rules are expanded at compute time: disabling re-runs answers instantly.

## What needs a 3-line rationale to change

Adding a stored derived table, mutating staged rows post-import, or merging Correction
into StandingRule. All three trade the live-compute guarantee for speed — prove the need
with perf numbers first.
