# Fuel-card exports (P-286)

Known-good shape (mirrors `fixtures/fuel-week.csv`):

- Columns: truck ID, date, gallons, amount, station.
- Quarantine triggers: missing amount, negative gallons, unparseable date.
- Tip: export per-truck statements, not fleet rollups — allocation needs truck identity.
- Pilot-specific vendor notes (Love's, Pilot/Flying J, TA/Petro, WEX, EFS) go here after
  pilot 1: menu path + quirks each.
