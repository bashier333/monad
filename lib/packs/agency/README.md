# Studio pack — project margins for video agencies

## Ontology

Entities: project, revision, asset, approval, client. Group key: project.
Measures: revenue/cost/margin (USD), marginPct (%), revisions (rounds),
turnaroundHours (hours). Cost kinds: labor (R-ag-1), rush (R-ag-2), asset (R-ag-3).
Overhead excluded in v1 (R-ag-4, stated everywhere).

## Sources

time, revision, approval, invoice, asset, rate, project, feedback — see
`docs/agency-import.md` for the supported-files matrix and quarantine glossary.

## Rules

Every rule carries a plain-English sentence shown next to answers. IDs stable
across versions (R-ag-1..R-ag-4). Corrections move/exclude like freight;
split-moves supported; previews show dollars-per-project before save.

## Vocabulary

project/projects, revision/revisions, week, margin. NL topics: losers, winners,
rework, approvals, bottlenecks. Entity word: “project”.

## Demos

`agency-video` (3-project video-shop week + invoices), `agency-design`
(retainer + fixed-bid mix + invoices). One-click seeds, checksum-idempotent.
