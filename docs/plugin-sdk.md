# Plugin SDK (R-011–R-019)

## Model

Plugins subscribe to the domain event bus (`lib/core/events.ts`). A plugin declares
`{ id, scopes, hook }`; the hook receives a sandboxed payload copy (no DB access,
2s timeout, mutations can't leak into the live event). Scopes are event types or `*`.

## Registering

```ts
import { registerPlugin } from "@/lib/core/events";
registerPlugin({ id: "my-plugin", scopes: ["import.completed"], hook: (e) => { ... } });
```

Registered in `lib/packs/register.ts` (boot). Core never imports packs — the
boundary test enforces it.

## Scopes (R-013)

`import.completed`, `import.needs_review`, `answer.viewed`, `correction.decided`,
`brief.generated`, `billing.changed`, or `*`. Out-of-scope events never reach the hook.

## Metering (R-017)

Plugin work is measured via `MeterEvent` with kind `plugin:<id>` when a plugin
performs metered side effects. v1 examples are read-only (logs), so no metering yet.

## Example plugins (R-019)

1. `audit-logger` — logs every event (`*`).
2. `import-stats` — counts completed imports per org (`import.completed`).
3. `correction-watcher` — logs decided corrections (`correction.decided`).

## Review process (R-016)

Security checklist before a plugin ships: no DB access, no network without review,
timeout respected, payload treated as untrusted input, scopes minimal.

## Marketplace listing format (R-014) + revenue share (R-018)

Listing format: id, name, version, scopes, description, permissions. Revenue share
plumbing (70/30) lands with the marketplace — not before (see R3 refusals).
