# Secrets inventory (S-601–S-609) + rotation posture

| Secret | Purpose | Scope | Rotation |
|---|---|---|---|
| AUTH_SECRET | session signing | server only, never client/logs | on schedule, login verified after |
| AUTH_GOOGLE_ID/SECRET | OAuth | server only (grep-gated) | provider console, no login gap |
| AUTH_RESEND_KEY | email | server only | rotate + test send |
| STRIPE_SECRET_KEY | billing | server only, live/test per env | rotate + webhook test |
| STRIPE_WEBHOOK_SECRET | webhook verify | per endpoint | rotate without loss |
| STRIPE_TEAM_PRICE_ID | checkout | env, never hardcoded (grep-gated) | n/a (id, not secret) |
| DATABASE_URL | postgres | server only, never in code | provider flow |
| SENTRY_DSN | error tracking | public DSN only (no secret) | n/a |
| APP_URL | link building | non-secret | n/a |
| NEXT_PUBLIC_POSTHOG_KEY | analytics | public key, autocapture off | n/a |
| REDIS_URL | queue/cache | server only | provider flow |
| Cron/admin tokens | jobs | server only | rotate + verify |

Rotation log + drills + sealed-store backups: ops calendar (S-611–S-620 open —
need a human with provider access). History scanned clean at authoring time;
CI audit-gate + `.env.example` hygiene test guard the future (S-621–S-623 note).
