# DPA Checklist + Subprocessor Outline (template — counsel review required)

This is NOT legal advice and NOT a signed DPA. It is the starting outline
our Data Processing Addendum must cover before any pilot with personal
data. Counsel reviews before first customer signature.

## What we process (today)

- Account data: names, emails, auth identifiers (Auth.js), org memberships.
- Operational data the customer uploads: loads, shipments, invoices,
  contacts (may contain names, phones, emails — PII).
- Telemetry: access logs (user + timestamp + action, 1 year), error
  reports with request IDs, product analytics events.
- We NEVER store: credentials for customer systems, payment card data
  (Stripe only), SSNs (scrubbed at ingest, tested).

## Duties we accept (to be bound in the DPA)

1. Process only on documented customer instructions (their uploads +
   their configured automations).
2. Confidentiality: tenant isolation enforced + tested; support access
   logged per read.
3. Subprocessors disclosed below; 30-day notice before changes.
4. Breach notification to customers without undue delay (<72h), with
   scope, data classes, and remediation (see incident-response.md).
5. Deletion: per-org "delete everything" including the documented backup
   window; export-first so exit never traps data.
6. No training of third-party models on customer data; zero-retention
   terms with model providers where applicable.

## Subprocessors (initial list — confirm before signing)

- Hosting provider (PaaS): compute + Postgres + object storage.
- Error tracking (Sentry, if DSN configured): stack traces + request IDs.
- Product analytics (PostHog, if key configured): product events only.
- Email delivery (Resend, if key configured): transactional mail only.
- LLM providers (per configured keys): prompts/completions under
  zero-retention terms; customer picks which are enabled.

## Data regions

- Default region: provider default (document actual region at signing).
- Region pinning available on request for Team+ (record the pin in the
  order form; verify bucket + DB region before go-live).

## Open before signature

- [ ] Counsel redline pass on this outline.
- [ ] Subprocessor list confirmed against actual configured vendors.
- [ ] Region + retention terms written into the order form.
- [ ] Pilot agreement references this DPA by version + date.
