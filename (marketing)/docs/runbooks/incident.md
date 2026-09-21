# Incident response, first hour (B-099)

Owner: the founder, until a team exists. Print this before you need it.

## 0–15 min: contain

1. `/api/health` — is the app up? What does `config.database` say?
2. `/api/admin/failures` — scope: which orgs, which imports, since when?
3. If data leak suspected: rotate AUTH_SECRET immediately (kills all sessions), then DB creds.
4. If bad deploy: redeploy previous green build (CI keeps every artifact).

## 15–45 min: assess

1. Access logs: who touched what (`AccessLog`, owner view via `/api/admin/failures` recentAccess).
2. Classify: data-loss risk? wrong-money risk (bad margins shown)? availability? privacy?
3. Wrong-money incidents get a wrong-answer postmortem per affected figure.

## 45–60 min: communicate

1. Affected pilots: what happened, what is safe, workaround, ETA. <1h, no exceptions.
2. Status note on the pilot channel; no jargon, no blame.
3. Open a bug issue from the template; link postmortems.

## After

- Postmortem within 72h. Fixture or eval case for every data-correctness root cause.
- If PII was involved: legal counsel before any further communication.
