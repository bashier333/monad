# Agency import guide (X4)

## Supported-files matrix (E-193)

| Tool / export | Source type | Required columns | Notes |
|---|---|---|---|
| Harvest / Toggl time export | `time` | Project, Date | Hours + Rate for rework costing |
| Revision log (any tool) | `revision` | Project, Date | Round column enables gap detection |
| Approval log | `approval` | Project, Sent | Signed enables order check |
| QuickBooks invoice export | `invoice` | Project, Amount | Attaches as project revenue |
| Asset manifest | `asset` | Asset | Version/Size/Status optional |
| Rate card | `rate` | Rate | One row per role; project optional |
| Project list | `project` | Project | Client/Start/Deadline/Budget attach |
| Feedback thread export | `feedback` | Round | Commenter/Timestamp/Text attach |

Row caps + guardrails (E-200): same as freight — 50k staged rows/run ingested,
500 error rows shown, 90-day free-tier history clamp. Files past the cap are
rejected before parsing with a plain-English reason, never silently truncated.

## Supported shapes

Time entries, revision logs, approval logs, invoices, rate cards, project lists,
feedback threads, asset manifests. See `fixtures/agency-*.csv` for the canonical shapes.

## Vendor presets

Harvest (time), Asana (tasks), Frame.io (reviews), QuickBooks (invoices), generic-agency.
The mapping screen shows only your pack's presets (E-186). Apply one, correct once,
and the corrected mapping is remembered per file shape.

## Mapping-confidence guide (E-195)

100% exact header match, 80% contains-match, 60% fuzzy (≤2 edits). Below 60% a
column stays unmapped and its rows quarantine on REQUIRED — map it by hand.
Agency examples: "Project" → project (100%), "HourlyRate" → rate (100%),
"TxnDate" → date (80% contains), "Assignee" → person (80%).

## Quarantine-code glossary (E-194)

REQUIRED (missing project/date per source), INVALID_DATE, INVALID_NUMBER,
NEGATIVE_VALUE, DUPLICATE_KEY (person+date+task+round), ROUND_GAP (round jumps,
e.g. R1→R3 — confirm renumbering), APPROVAL_ORDER (signed before sent),
ENCODING (replacement character — re-export as UTF-8 or CSV).

## Matching rules

- Time/revision rows join invoices on normalized project name.
- Unmatched invoices are listed, never hidden (check them — usually a client-name variant;
  add an alias and they attach).
- Duplicate time entries (person + date + task) quarantine with DUPLICATE_KEY.
- Conflicting hours for the same person/date/task from two sources are both kept
  and listed as hour conflicts — never silently overwritten (E-190).

## Troubleshooting (E-197)

| Symptom | Cause | Fix |
|---|---|---|
| Everything quarantines with REQUIRED | Export renamed Project/Date columns | Map them on the mapping screen |
| ROUND_GAP on every row | Tool restarts numbering per episode | Confirm once, or add alias note |
| APPROVAL_ORDER flags | Signed date is really the due date | Map it to Date instead of Signed |
| Mojibake client names | Latin-1 export | Re-export UTF-8, or leave it — we decode Latin-1 |
| TOTAL row missing from answers | Footer rows skip at parse (counted) | No action; check the skipped count |
| Hours all zero | Rate card has no hours by design | Attach a time export for labor cost |

## Import recovery runbook (E-198)

1. Open the import — status, progress, OK/quarantined counts are at the top.
2. NEEDS_REVIEW means duplicate file or overlapping week: Merge, Replace, or Skip.
3. Row errors list the first 50 with codes from the glossary above.
4. Conflicts with prior imports list field-by-field; current file never overwrites
   history until you confirm Replace.
5. Stale runs (worker died mid-import) reset to PENDING automatically within 30 min.

## Encoding decision log (E-199)

- UTF-8 BOM stripped; UTF-16LE/BE by BOM decoded.
- Strict UTF-8 tried first; Latin-1 fallback keeps diacritics (Café stays Café).
- Replacement character (�) in any value quarantines the row with ENCODING.
- Fixtures: agency-unicode (diacritics pass), latin-1 + BOM cases in corpus tests.
