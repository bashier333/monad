# Evals (R-119)

## NL evals (freight 30 + agency 30, CI-gated)

`lib/packs/*/nl.test.ts`: query → intent, blocks merge on failure. Add cases by
appending `[input, expected]` rows; prune stale ones monthly (R-425 calendar).

## NL-action eval (50 commands, CI-gated, R-139)

`lib/core/answers/actions.test.ts`: flag/alert/rerun/export/invite intents +
non-action guard (NL answers still own those). New verbs need 3+ cases each.

## Cross-pack routing (R-421)

`lib/packs/nl-routing.test.ts`: pack-specific topics disjoint; shared
losers/winners intentional; both parsers degrade gracefully on alien queries.

## Regression gate (R-113/R-424)

Same rule for all evals: red evals block merge. Model/prompt changes don't exist
yet (deterministic product) — the gate is ready for them.

## Human-rated sample (R-117/R-428)

Monthly 100-answer sample + correction-quality sampling: calendar items, need
humans. Correction stats API (`byStatus`, rules %) is the machine half.
