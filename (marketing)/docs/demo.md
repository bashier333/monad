# Demo flows (P-257–P-261)

- Industry packs on `/upload`: dry-van (default), reefer, flatbed — one click each, real
  pipeline, checksummed so re-clicks skip.
- `DemoTour`: 5-step overlay, dismiss persists in localStorage.
- `DemoResetButton`: slug-confirmed wipe (same delete path as settings).
- Graduate: `POST /api/demo/graduate` removes sample-* runs/rows/files, keeps mappings,
  aliases, rules. The handoff from sample to real.
- Shareable demo: any owner creates a 30-day share link from Answers — send that link to
  the champion's boss instead of booking another call.
