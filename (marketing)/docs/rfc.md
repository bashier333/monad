# RFC process (R-931) + ADRs (R-938) + release train (R-935) + review SLAs (R-932)

## RFCs

Big changes (new pack, schema change, new integration) start as a 1-page RFC:
problem, options, decision, rollout, rollback. Discussed async, decided in 48h.
Small changes ship without one.

## ADRs

Architecture decisions live in `docs/adr/` (numbered, dated, immutable).
First: `0001-events.md` (event bus over direct calls).

## Release train (R-935)

Weekly, Thursdays. No hero releases. Flags gate risky changes (`featureFlags` in
org settings). Rollback = revert + redeploy; migrations are additive-only
(zero-downtime patterns, R-545 note).

## Review SLAs (R-932)

<24h first review. Quality bar: tests for logic, docs for behavior changes,
no freight words in core, no pack imports in core.

## Testing standards (R-934)

Unit (pure logic, vitest) / contract (`routes.test.ts` manifest + auth audit) /
e2e (`scripts/e2e-pack.ts` per pack on staging). Eval failures block merge.
