# Desktop / Exe Verification — N topics (main → perf)

Verified against `electron/main.cjs` (483 lines), `preload.cjs`,
`prepare.cjs`, package.json builder config, and the update/sqlite/desktop
lib modules on 2026-09-21. The exe is loopback-only by design.

- main-boot: single-instance lock, per-user env (`monad.env` + generated
  AUTH_SECRET 0600), machine identity, ephemeral loopback port, splash
  until healthy.
- health-gate: `waitForHealthy(/api/health, 90s)` requires `ok:true`
  (server self-reports DB reachability); degraded screen with auto-retry,
  workspace never opens on failure.
- sqlite-wal: WAL+NORMAL+busy-timeout+FK enforcement, template DB copy on
  first boot, refuse-to-boot without Organization table.
- user-env/machine-id: `%AppData%/monad.env` provisioning; MachineGuid
  with hostname fallback, sha256-normalized for identity.
- single-instance: second launch focuses, never double-boots the server.
- csp-nav: loopback-only in-app URLs; https:/mailto: external via shell;
  everything else denied.
- preload-bridge: read-only facts + 3 narrow updater calls. No
  require/ipc/shell in the renderer — additions reviewed like APIs.
- bootstrap-auth: cookie-less bootstrap → machine org + OWNER + 365d
  session, access-logged.
- offline-banner: DB-down renders nav + empty states per source
  (workspace `Promise.all(...).catch(fallback)`); SAMPLE DATA banner when
  no completed feeds.
- queued-intents: `lib/core/offline-queue.ts` (enqueue FIFO, idempotency
  dedupe, ordered drain through the governed executor). In-memory in the
  single-process worker; SQLite persistence is the documented exe
  follow-up — contract is storage-agnostic.
- update-feed: generic provider feed from dist artifacts (`latest.yml` +
  sha512), autoDownload off, install-on-quit, portable falls back to
  manual with an honest message. No feed URL = dormant, never broken.
- download-page: serves newest Setup-*.exe by mtime, zip fallback,
  env overrides.
- portable-mode/nsis-install: per-user NSIS + portable x64, no elevation,
  shortcuts optional, AppData preserved on uninstall.
- splash: frameless 420x320, health-gated handoff.
- deep-links: DELIBERATELY ABSENT. No protocol handler, no `monad://`
  claims anywhere (grepped). Loopback-only exe has no external protocol
  surface — smaller attack surface by design, recorded here.
- crash-report: `crashReporter.start({uploadToServer:false})` — local
  dumps only, never exfiltrated.
- perf-cold/perf-warm: budgets cold <2s / warm <1s / INP p75 <200ms are
  architectural (standalone server + splash + lazy viz) with a 90s health
  ceiling. NOT measured on this box (no packaged exe here) — measure on
  first signed build with cold/warm timers, then record. Honest gap,
  owned.
