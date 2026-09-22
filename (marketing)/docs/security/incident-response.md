# Incident Response 1-Pager — first hour of a breach or leak

Owner: platform on-call. If unreachable, the founder. Review quarterly;
drill the restore path on staging every 6 months (see app runbook).

## Minute 0–15: contain

1. Identify scope: which org(s), which tables/routes, from access logs
   (1-year retention) + error tracker with request IDs.
2. Revoke exposure first: rotate share tokens (`board:share-revoke`),
   revoke API keys (`/api/keys`), disable the webhook/connector involved.
3. If data is actively exfiltrating: set the org read-only (dunning lock
   path reuses the same guard), then stop the worker.
4. Preserve evidence: export the relevant access-log + audit-chain slice
   BEFORE rotating anything else (rotation destroys nothing, but export first).

## Minute 15–45: assess

5. Was it truth or noise? Confirm with a second signal (billing anomaly,
   support report, second log source). Log the decision either way.
6. Classify: PII involved? credentials? customer operational data? Each
   class has a different notification duty (see DPA checklist).
7. Scope the blast radius: tenant isolation means one org's rows never
   imply another's — verify, don't assume (run the tenancy check).

## Minute 45–60: communicate + recover

8. Notify affected pilot owners directly (<4h SLA in beta) with: what
   happened, what data, what we did, what happens next. No euphemisms.
9. Restore from backup if integrity is in doubt (runbook in app README;
   row counts verified before reopening writes).
10. File the postmortem within 48h (template: docs/postmortem-template):
    root cause, fix, fixture added so CI catches the class next time.

## Never

- Never pay, never hide, never delete logs to "clean up".
- Never bring the system back without knowing the entry point.
- Never skip the customer note because "it was small".
