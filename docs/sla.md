# SLAs (R-091–R-099)

## Target (R-091)

99.9% uptime monthly for the app + API. `/status` shows live health with history
(changelog entries serve as the incident record until a dedicated history ships).

## Support tiers (R-094)

- Free: community help page, best effort.
- Team: email support, <1 business day.
- Scale: priority support, <4h, phone on majors.

## Escalation matrix (R-095)

Support → on-call engineer → founder. Majors page the engineer immediately;
customers get status updates every 30 min until resolved.

## Postmortems (R-093)

Every major gets a public postmortem in the changelog: what broke, who was
affected, what changed. No exceptions, no blame.

## DR (R-097)

RTO 4h, RPO 24h (daily backups, point-in-time recovery tested quarterly per runbook).
Region failover is active-passive — see scaling docs.

## Credits (R-096, scale tier)

Below 99.9% in a month: 10% service credit; below 99%: 25%. Claimed by email,
applied to the next invoice, no negotiation theater.

## Compliance (R-099)

Trust center (`/trust`) lists certs, reports, subprocessors, and the security
contact. Penetration test annually — summary shared under NDA (R-098 open: needs vendor).
