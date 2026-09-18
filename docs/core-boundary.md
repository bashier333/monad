# Core boundary rules (E-002)

Core (`lib/core/`) is pack-agnostic. Enforced by `tests/boundaries.test.ts` (CI):

1. Nothing in `lib/core/` imports from `lib/packs/`. Ever.
2. No file imports pre-extraction paths (`@/lib/ingest/`, `@/lib/margin/`, ...).
3. Domain words (lane, load, truck, detention, revision, SKU, ticket) do not appear in
   core identifiers. Domain words in *comments/docs* are fine.
4. New shared code goes in core only if two packs need it (rule of two).

Violations fail the build. Exceptions require a dated comment + issue link.
