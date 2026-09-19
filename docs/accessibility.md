# Accessibility statement (R-449)

## What holds today

- Skip-to-content link + `:focus-visible` outlines everywhere.
- Data tables carry `aria-label`s and `scope="col"` headers.
- `prefers-reduced-motion` disables animation; `prefers-contrast: more` darkens muted text.
- Margins are never color-only: every figure prints $ and sign, red/green is decoration.
- Font-size scaling: layout is fluid (max-w + scroll containers), no fixed-pixel traps.

## Gaps (honest)

- No full WCAG 2.2 AA audit yet (R-441 open — needs an auditor).
- Keyboard-only end-to-end (R-442) works for read flows; correction dialogs need a
  keyboard pass (open issue).
- No axe CI gate yet (R-448 open — needs a browser runner).

## Contact

Accessibility bugs are treated as defects, not requests: report via support and
they join the next release train.
