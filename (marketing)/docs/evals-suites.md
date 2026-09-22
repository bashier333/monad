# Eval Suites — release gate for non-determinism (I-phase)

Suites pin targets, cases, judges and thresholds; regressions block merge.
Proof: `lib/core/evals/evals.test.ts` (15 tests). History:
`lib/core/evals/history.ts` on EventLog (`eval.suite-run`).

## Suite

`{key, name, targetKind: function|agent|formula, targetRef, cases[1..500],
judge, passRate, maxVariance?}`. Cases: `{name, input, expected,
tolerance?, adversarial?}`. Validation rejects empties, bad keys and
unknown judges before anything runs.

## Judges (all executed, all blocking)

- exact: byte equality.
- tolerance: numeric closeness with per-case override.
- contains: serialized substring (for drafted text).
- groundedness: every `citedIds` entry must exist in `contextIds`;
  empty citations fail; ungrounded ids named.
- llm: injected judge scored against a threshold (default 0.8). No wired
  judge fails closed — never invented.

## Variance protocol

Each case runs N times (1–25). Pass needs mean ≥ 0.5 AND fail share ≤
maxVariance. Passed-once-failed-once cases quarantine BY NAME
(`flaky: [...]`) — visible, never vanishing.

## Comparison

`compareReports` names winners by pass rate, then mean score, else tie —
for model swaps (NVIDIA vs Anthropic vs OpenAI) and version promotions.

## Ontology-edit scoring (separate dimensions)

Policy, approval and evidence score independently. Policy is a veto: a
non-compliant edit never passes, however well-evidenced. Approval gates
execution. Rationale: one quality number cannot encode the tradeoffs —
false approval costs far more than manual review.

## Release rule

`decideRelease`: pass rate clears threshold AND no regression vs the last
green baseline (`lastGreenBaseline`) AND zero unquarantined flakes.
Quarantine is explicit naming, never silence.

## History = the results dataset

`recordEvalRun` writes `eval.suite-run` rows; `evalHistory` reads them
newest-first, optionally per suite. Dashboards and audits query this —
no second store to drift.
