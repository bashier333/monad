# Auth matrix (P-040) — generated from the contract suite, drift fails CI

Every non-public route returns 401 `{error: "unauthorized"}` without a session.
Public routes and their auth model:

| Route | Auth model |
|---|---|
| `GET /api/health` | none (liveness; reports config presence, never values) |
| `GET /api/share/[token]` | bearer token in URL, 128-bit, 30-day expiry, revocable |
| `GET+POST /api/auth/[...nextauth]` | the auth handler itself |
| `GET /api/email/unsubscribe` | HMAC-signed per-user link |
| `GET /api/debug-error` | dev-only; 404 in production |
| `POST /api/billing/webhook` | Stripe-signature verified, never session-authed |

Role matrix (enforced server-side via `requireCan`, tested in `lib/roles.test.ts`):

| Action | Owner | Dispatcher | Viewer |
|---|---|---|---|
| answer:view | ✓ | ✓ | ✓ |
| upload:import | ✓ | ✓ | — |
| correction:propose | ✓ | ✓ | — |
| correction:approve | ✓ | — | — |
| rule:manage | ✓ | — | — |
| org:invite | ✓ | — | — |
| billing:manage | ✓ | — | — |

Cross-org reads return 404 (never 403) so IDs are not oracles.
