# SOC 2 path (B-100) — opened, not started

Target: Type I within 12 months of first paying org, Type II the year after — *if* enterprise
deals require it. Do not certify for the sake of it.

## Readiness checklist (Vanta/Drata or auditor)

- [ ] Access control: roles enforced server-side (done — `lib/roles.ts` + tests)
- [ ] Audit logging: access logs retained 1y (done — `AccessLog`)
- [ ] Change management: CI green required, migrations reviewed (done)
- [ ] Incident response: written 1-pager (done — `docs/runbooks/incident.md`)
- [ ] Backups + restore drills: monthly log (runbook done, drills pending staging)
- [ ] Vendor management: subprocessor list current (below)
- [ ] Employee offboarding: n/a solo — write when hiring

## Subprocessors (B-098)

Hosting, Postgres, object storage, Resend (email), Stripe (billing), PostHog (analytics),
Sentry (errors), Google (OAuth). Pin regions to US; DPA signed with each before pilot data
flows. Data-region pinning documented per vendor in the DPA file (ask counsel for the template —
do not DIY the legal text).
