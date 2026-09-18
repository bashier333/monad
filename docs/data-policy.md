# Data policy (B-025) — hygiene, not a product claim

All `fixtures/*.csv` are **synthetic**: invented carriers, people, and numbers. No real PII was
harmed. Real customer exports must be scrubbed the same way before becoming fixtures.

## What we store per import

- The uploaded file bytes (local `var/uploads`, S3 in later hardening), filename, checksum.
- Parsed staged rows + quarantined rows with reasons. Nothing is silently dropped.
- Column mappings, corrections, and the decision trail.

## What we NEVER store

- Driver SSNs, license numbers, or any government ID.
- Bank account / routing numbers (factoring data stays with the factor).
- Exact home addresses (city-level origin/destination only).
- Credentials of any kind (TMS passwords, API secrets belong in the secret store, never the DB).

## Retention & deletion

- Default retention follows the pricing tier (90d Starter → 1y Team → full Scale).
- "Delete everything" per org removes rows, files, and trails; backups age out in 30 days.
- Every deletion is logged with who + when.

## Access

- Org data is visible only to that org's members, enforced server-side by role (see `lib/roles.ts`).
- Support access to a pilot's data requires written permission per incident.
