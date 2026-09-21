# Monday brief schedule (B-063 follow-up)

Beta: briefs generate on demand (`GenerateBriefButton` → `POST /api/briefs/generate`).
Target state: every org gets its brief before 7am local Monday.

## Options when ready

1. **Vercel Cron** (if hosted on Vercel): `vercel.json` crons → `GET /api/cron/brief?secret=$CRON_SECRET`
   hitting the same generate logic per org. Free tier covers weekly.
2. **pg-cron / pgmq** (if on Postgres PaaS): schedule a worker that calls the generate endpoint.
3. **BullMQ repeatable job** (once Redis lands with Phase 1 hardening): `brief-weekly` repeat,
   timezone per org.

## Requirements for any option

- Idempotent generate (upsert on org+week — already the case).
- Skip orgs with zero staged rows that week (don't send empty briefs — add the guard when wiring cron).
- Record emailedTo (already stored on Brief).
- One-click unsubscribe already live (`/api/email/unsubscribe`, List-Unsubscribe header to add
  when Resend sends real mail).
