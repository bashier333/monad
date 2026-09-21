# Desktop auto-updates

The installed app (NSIS) updates itself. Portable copies do not — they have
no install location to update into, so they fall back to a download link.

## How it works

- The website is the update server. `GET /api/updates/latest.yml` describes
  the newest `Monad-Ontology-Setup-*.exe` in `dist/` (version parsed from the
  filename, never from running code). `GET /api/updates/[file]` serves the
  installer and its `.blockmap` for differential downloads.
- The exe reads `UPDATE_FEED_URL` (real env beats `monad.env`) and checks once
  ~45s after boot, plus on demand from the workspace footer (“Check for
  updates”). Auto-download is off: the user confirms the download, then
  confirms the restart. `quitAndInstall` runs only from those two clicks.
- No session, no org data, no secrets touch the feed. sha512 values are
  cached per file (mtime + size) so 300MB installers are hashed once.

## Publishing a release

1. `npm run release <x.y.z> -- --notes="headline one;headline two"` — bumps
   `package.json`, `lib/core/version.ts` (single source), the changelog page,
   `CHANGELOG.md`, and the lockfile together. Nothing else needs hand-editing:
   health, status, landing, download, `/api/desktop`, and the exe feed all
   read the single source at runtime.
2. Gates: `npm run typecheck && npm run lint && npm run test`.
3. `npm run dist:exe` (with `SQLITE_TEMPLATE=1` for the template DB).
4. Confirm `dist/Monad-Ontology-Setup-<version>.exe` (+ `.blockmap`) exists.
   The feed picks the newest version by semver, not by file date.
5. Deploy the website. Clients with `UPDATE_FEED_URL=https://<host>/api/updates`
   pick it up on next launch (or via Check for updates).
6. Commit: `git add -A && git commit -m "feat: v<x.y.z> — <headline>"`.

## Client configuration

- Installed exe: add `UPDATE_FEED_URL="https://<host>/api/updates"` to the
  user `monad.env` (same file as `AUTH_SECRET`). Without it the updater
  stays dormant and the footer offers the download page instead.
- Unsigned builds: Windows SmartScreen warns on first install and first
  update (“Unknown publisher”). A code-signing certificate removes this;
  there is no code path around it.

## Limits, stated plainly

- NSIS only. Portable copies, dev shells, and browsers get a download link,
  never a silent update.
- No staged rollouts or channels — one feed, newest version wins.
- Feed staleness: the feed describes `dist/` contents. If the site serves a
  newer build than `dist/` holds, clients see the older one until repackaged.
