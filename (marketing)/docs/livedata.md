# Live data model

Real public-records checks behind `/api/check` and the on-site Live records demo.

## Sources (all keyless, all degradable)

- **OpenCorporates** — registry status, dissolution dates, addresses. Optional `token` param.
- **CourtListener** — docket counts and top case names. Optional `token` param. 401/403 degrades.
- **EDGAR** — CIK resolution via company tickers, 10-K/10-Q presence, distress keywords in 8-K descriptions. Sends SEC `User-Agent` (`SEC_CONTACT` env or default).
- **GDELT** — 90-day press volume and tone, English only.

Every connector takes an injectable `fetchImpl`, enforces timeouts, retries 429/5xx, and returns `{ ok, flags, error, latencyMs, degraded }`. A failed source never fails the check.

## Fusion and verdict

`fuse.ts` dedupes, weights by source trust, and sorts critical-first. `verdict.ts` scores from 88 minus severity hits (KILL under 40, FUND at/above 70) and always names degraded sources in the explanation. Empty evidence means REVIEW, never FUND.

## API and cache

`POST /api/check` is public, rate-limited (10/min), cached 15 minutes (500 entries), and logs evaluations for authed users. Response carries `verdict, score, explanation, evidence[], degradedSources[], elapsedMs, cached`.

## Rollout notes

- Optional env: `SEC_CONTACT` for the EDGAR user agent; `AUTH_RESEND_KEY`/`EMAIL_FROM` already cover mail.
- Watch per-source `degradedSources` rates; a source down for a day is normal, a week is an incident.
- Reviews/social data is intentionally absent: no keyless honest source exists. The site says so nowhere because it claims nothing about reviews live.
