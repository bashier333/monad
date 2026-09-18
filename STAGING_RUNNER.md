# Staging Runner — Decision Layer
#
# Provisions a full staging environment locally for the tasks that need it:
#   P-018  10k-load CSV export streamed without OOM
#   P-127  100k-row end-to-end import timing
#   P-128  250k-row import progress monotonicity
#   P-305  Verify data-region pins per vendor
#   P-355  k6: 5 concurrent recomputes
#   P-356  k6: 50 concurrent viewers
#   P-357  k6: 30-min soak at 2x pilot load
#   P-358  k6: spike test (10x for 60s)
#
# Prerequisites:
#   - Docker Desktop (or Docker Engine + Compose v2)
#   - k6 binary (https://k6.io) for load tests
#   - Stripe test keys (for billing tests)
#
# Setup:
#   1. cd app
#   2. cp .env.example .env
#   3. Fill in .env (names match app/.env.example):
#      - AUTH_SECRET=$(openssl rand -base64 32)
#      - AUTH_URL=http://localhost:3000
#      - STRIPE_SECRET_KEY=sk_test_...       (from stripe.com/test/apikeys)
#      - STRIPE_WEBHOOK_SECRET=whsec_...     (from stripe.com/test/webhooks)
#      - STRIPE_TEAM_PRICE_ID=price_...      (from stripe.com/test/prices)
#      - AUTH_RESEND_KEY=re_...              (optional, for email tests)
#   4. docker compose up -d
#   5. Wait for healthchecks: docker compose ps
#   6. Apply DB migrations: docker compose exec app npx prisma db push
#   7. Seed demo data:    docker compose exec app npx tsx prisma/seed.ts
#
# Verify:
#   curl http://localhost:3000/api/health   # → {"ok":true}
#   open http://localhost:3000              # landing page
#
# Run the Stripe E2E verification (P-201–P-210, P-213–P-217, P-231, P-236, P-278):
#   export BASE_URL=http://localhost:3000
#   export STRIPE_SECRET_KEY=sk_test_...
#   export STRIPE_WEBHOOK_SECRET=whsec_...
#   export STRIPE_TEAM_PRICE_ID=price_...
#   export STRIPE_ANNUAL_PRICE_ID=price_...   # optional
#   export STRIPE_COUPON_ID=coupon_...        # optional
#   npx tsx stripe-e2e.ts
#
# Run k6 load tests (P-355–P-358):
#   # First, sign in and capture a session cookie:
#   export SESSION="next-auth.session-token=..."  # from browser devtools
#
#   # P-355: 5 concurrent recomputes
#   k6 run -e BASE=http://localhost:3000 -e SESSION="$SESSION" k6/recompute.js
#
#   # P-356: 50 concurrent viewers
#   k6 run -e BASE=http://localhost:3000 -e SESSION="$SESSION" k6/viewers.js
#
#   # P-357: 30-min soak at 2x pilot load
#   k6 run -e BASE=http://localhost:3000 -e SESSION="$SESSION" k6/soak.js
#
#   # P-358: spike test (10x for 60s)
#   k6 run -e BASE=http://localhost:3000 -e SESSION="$SESSION" k6/spike.js
#
# Cleanup:
#   docker compose down -v   # stop + remove volumes (wipes DB)
