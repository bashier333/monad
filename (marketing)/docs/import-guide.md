# Import guide (P-158–P-160)

## Supported files (P-158)

| Type | Max | Encodings | Layouts |
|---|---|---|---|
| .csv | 50MB / 500k rows | utf-8 (±BOM), utf-16, latin-1 fallback | single header row; footer totals skipped; `#` comments skipped; blank lines counted |
| .xlsx | 50MB / 500k rows | n/a | first visible non-empty sheet; no macros; no external links |

Rejected with guidance: password-protected, charts-only, headerless, transposed single-column.

## Quarantine codes (P-159)

| Code | Meaning | Fix |
|---|---|---|
| REQUIRED | required field empty | fill the column |
| INVALID_DATE | unparseable date | use YYYY-MM-DD |
| INVALID_NUMBER | non-numeric in numeric field | strip symbols/letters |
| NEGATIVE_VALUE | negative miles/amounts | check sign |
| DUPLICATE_KEY | load ID already in this file | dedupe |
| ENCODING | replacement char — source encoding suspect | re-save as UTF-8 CSV |
| FOOTER (skipped) | totals row, not a load | none needed |

## Mapping confidence (P-160)

1.0 exact header match · 0.8 contains-match · 0.6 fuzzy (≤2 edits). Below that: unmapped,
you pick. Vendor presets (generic, McLeod, TMW, Prophesy, Ascend) one-click apply; your
correction becomes the default next time.
