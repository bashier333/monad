# Upload guides per TMS (B-116)

One file per system your pilots actually export from. Fill in from the concierge call —
menu paths, quirks, and a 5-row sample go here, then link from `/help`.

## Template (copy for each new system)

```md
# {System} settlement export

- Menu path: ... (e.g. Reports → Settlements → Export CSV)
- Date range control: ...
- Load ID column: {name} — notes: ...
- Revenue column(s): {names} — notes: ...
- Known quirks: (e.g. detention folded into linehaul; negative adjustments as separate rows)
- Sample: fixtures/{system}-sample.csv (5 scrubbed rows)
- Mapping preset: {which auto-detect result, what to hand-fix}
```

## Systems

- [generic-csv](generic-csv.md) — any export shaped like our fixture (start here).
- [McLeod](mcleod.md) — fill in from pilot 1.
- [TMW Suite](tmw.md) — fill in from pilot 1.
- [Prophesy](prophesy.md) — fill in from pilot 1.
- [AscendTMS](ascend.md) — fill in from pilot 1.
