# Chaos recovery (B-090)

## Worker dies mid-import (in-process queue, current beta)

- The run stays PROCESSING forever. Nothing is half-written: staged rows and errors are only
  committed per completed stage, and finalize is a single status flip after all writes.
- Recovery: `POST /api/admin/sweep` (owner-only) resets PENDING/PROCESSING runs untouched for
  30+ minutes back to PENDING with a note. Re-upload is also safe: checksum dedupe catches the
  retry and routes it to review instead of double-importing.
- After BullMQ+Redis lands: the sweeper becomes a repeatable job; in-flight jobs get
  at-least-once retries with the same checksum guard.

## DB dies mid-recompute

- Answers are live-computed, never cached: a DB outage means failed reads, never corrupt
  answers. Imports fail loudly (FAILED + reason), never silently.
- Recovery: restore from backup (runbook in `app/README.md`), re-run `/api/admin/sweep`,
  re-upload anything FAILED. Verify with the fixture gauntlet (`npm test`).

## What we fixed vs documented

- Fixed: stale-run reset endpoint + test, checksum dedupe on retry, no silent drops anywhere.
- Documented (needs staging to prove): concurrent-recompute behavior, restore drill timings.
