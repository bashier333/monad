# Secrets rotation (B-094)

First rotation completed 2026-09-18 (dev AUTH_SECRET regenerated — see shell history).

## Inventory (all in host secret store in staging/prod, `.env` local only)

| Secret | Rotation | How |
|---|---|---|
| AUTH_SECRET | 90 days | `openssl rand -base64 32` → update store → rolling restart → verify login |
| AUTH_GOOGLE_SECRET | on suspicion | Google Cloud Console → update store → restart |
| AUTH_RESEND_KEY | on suspicion | Resend dashboard → update store → test send |
| STRIPE_SECRET_KEY | on suspicion | Stripe dashboard → update store + webhook secret → test webhook |
| DATABASE_URL | with provider rotation | PaaS console → update store + backup job → verify `/api/health` |
| S3 keys | 90 days | Provider console → update store → test upload |

## Rules

- Rotate one secret at a time, verify, then move on.
- Never commit secrets (CI secrets-scan blocks `.env` + private keys).
- After any suspected leak: rotate, force logout (clear sessions table), notify pilots within 24h.
