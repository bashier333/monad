# Error copy styleguide (R-478)

Plain words, no codes to users. Pattern: what happened + the one next action.

- Bad: `VALIDATION_ERROR 422`. Good: "Upload a .csv or .xlsx file (max 50MB)."
- Bad: `QUOTA_EXCEEDED`. Good: "Free tier: 10 uploads/month — upgrade to Team for unlimited."
- Bad: `AUTH_401`. Good: "Sign in to see answers."
- Bad: `STALE_DATA`. Good: "Data as of {date} — re-run this week after your import lands."
- Bad: `RATE_LIMITED`. Good: "Rate limited — slow down." (Retry-After header included.)
- Bad: `NOT_FOUND`. Good: "Import not found." / "No brief for week of {week} yet." + link to generate.
- Bad: `PAYLOAD_TOO_LARGE`. Good: "payload too large" (webhook-in, machine audience — technical is fine).
- Bad: `UNKNOWN_PACK`. Good (API): "pack must be freight|agency" (machine audience).

Machine APIs (v2, webhooks) return `{error: {code, message, requestId}}` — codes for
machines, messages still plain. Quarantine codes (REQUIRED, ROUND_GAP…) appear only
in operator-facing tables with the glossary one click away.
