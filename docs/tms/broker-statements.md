# Broker statements (P-287)

Known-good shape (mirrors `fixtures/broker-statement.csv`):

- Columns: load reference, factor fee, paid date.
- Matching: `LoadRef` joins TMS `LoadID` case-insensitively after trim.
- Unmatched fees are listed in import review — never silently dropped.
- Factoring-company formats (RTS, TAFS, OTR) go here after pilot 1: quirks each.
