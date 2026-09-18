# Pack retro template (X10 E-487–E-490)

## Per-pack retro (taught / dies / next)

- Taught: what did this pack teach about the core boundary?
- Dies: what pack code gets deleted, and what happens to its data?
- Next: which scored vertical inherits the tactics?

## Dead-pack deletion process (E-488)

1. Offboard pilots (export their data first — `/api/org/data`).
2. Disable pack in every org (`enabledPacks`), keep reads for 30 days.
3. Delete pack code + fixtures + docs; core stays untouched.
4. Announce in changelog with migration path or refund.

## Kill-gate history (E-489)

Preserved per pack: trail queried weekly by ≥2 pilots? corrections→rules >30%?
≥1 conversion? GO / RE-SCOPE / KILL with date. Whatever the outcome, the retro
is published internally.

## Expansion pacing rule (E-490)

No pack #3 without a pack #2 conversion. Scored list picks the candidate;
a paid pilot in 30 days or it dies.
