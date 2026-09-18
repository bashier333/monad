# Decision Layer app (Phase 0 scaffold)

## Quickstart

1. Install Docker Desktop, then start Postgres + Redis:
   `docker compose up -d`
2. Install deps: `npm install`
3. Copy env: `cp .env.example .env` and set `AUTH_SECRET` (`openssl rand -base64 32`).
4. Push schema: `npm run db:push`
5. Seed demo org: `npm run db:seed`
6. Run: `npm run dev` → http://localhost:3000, health at `/api/health`.

## Scripts

- `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build`
- `npm run db:generate` / `db:push` / `db:seed`

## What's stubbed (needs keys/accounts, by phase)

- Google OAuth + Resend magic links (B-006): providers wired in `lib/auth.ts`, credentials pending.
- Sentry (B-010): structured logging + request IDs live; DSN pending.
- PostHog (B-011): `track()` no-ops without key; call `initAnalytics()` from a client root later.
- Uptime monitor (B-012): point Better Uptime/UptimeRobot at `/api/health`; alert to your phone.
- S3 + Stripe: placeholders in `.env.example` for Phases 1 and 7.

## Runbooks

- Backup drill (B-014): `docker compose exec postgres pg_dump -U decision decisionlayer > backup.sql`;
  restore: `cat backup.sql | docker compose exec -T postgres psql -U decision decisionlayer`.
  Run monthly once pilots are live; record row counts before/after.
- Incident (B-099): `/api/health` first, then error tracker, then access logs; comms to pilots <1h.
