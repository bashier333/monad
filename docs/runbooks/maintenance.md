# Scheduled maintenance (P-318)

- Announce 72h ahead: pilot channel + status page note + brief footer line.
- Window: Sunday 0600–0800 org-local, max 30 min downtime.
- Migrations run first on staging refresh; prod deploys only after green.
- Post-window: health + smoke (login → answers) verified before all-clear.
