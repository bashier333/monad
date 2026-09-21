# Core (E-047/E-048)

`lib/core/` is the pack-agnostic substrate: ingest pipeline, corrections engine, brief
builder, answer service, billing, auth, jobs, cache, notifications, guards, storage.

## Stability contract

- Core interfaces are semver'd. Breaking changes need a major bump + migration notes.
- Packs pin the core version they were certified against (recorded in pack manifest).
- New shared code enters core only under the rule of two (two packs need it).

## Versioning

- Patch: bug fixes, no interface change.
- Minor: additive interfaces (new optional params, new exports).
- Major: any breaking change. Announced one release ahead with a codemod where possible.
