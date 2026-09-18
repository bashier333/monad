# Agency import guide (X4)

## Supported shapes

Time entries, revision logs, approval logs, invoices, rate cards, project lists,
feedback threads, asset manifests. See `fixtures/agency-*.csv` for the canonical shapes.

## Vendor presets

Harvest (time), Asana (tasks), Frame.io (reviews), QuickBooks (invoices), generic-agency.
Apply a preset on the mapping screen; correct once and it becomes your default.

## Matching rules

- Time/revision rows join invoices on normalized project name.
- Unmatched invoices are listed, never hidden (check them — usually a client-name variant;
  add an alias and they attach).
- Duplicate time entries (person + date + task) quarantine with DUPLICATE_KEY.
