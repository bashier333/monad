# Coverage and third-party playbooks (P-298/P-299)

## Holiday/travel coverage (P-298)

- Alerts route to the founder's phone (UptimeRobot + Sentry). Backup human named in the
  pilot channel before any absence. Deploy freeze during absence unless incident.

## Third-party outage (P-299)

- Stripe down: checkout/portal show guidance; webhooks queue server-side and replay.
- Resend down: magic links fall back to concierge-sent links; briefs stay in-app.
- Google OAuth down: status page + retry path; existing sessions unaffected.
- PostHog/Sentry down: product unaffected (fire-and-forget verified).
- S3 down: uploads fail with guidance; DB untouched. See incident runbook for comms.
