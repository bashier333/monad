# Ontology Actions Matrix — verification record (F2-03551..F2-04000)

Every action below was verified against code on 2026-09-21. Shared engine
proof: `executeAction` (`execute.ts`) — idempotency-key replay,
approval gates, pre-commit webhook veto (fail-closed), `$fn.*` resolution,
before/after hash-chained audit, per-object bulk status. Route proof:
`tests/routes.test.ts`. Approval notifications: `requestApproval` →
`notifyOrg` → `/ontology/inbox` (`execute.ts:151`).

Shared truths (all actions):

- Definition: `OntoAction{key, targetTypeKey, effects[1..20], approvalPolicy,
  requiredCount}` validated by `validateActionDef` (actions.ts).
- Preview: dry-run shows before/after without writing (preview route;
  response carries `autoEligible` from the `canAutoExecute` gate).
- Submission criteria: param rules enforced; field-level errors, never 500.
- Roles: `ontology:manage` on routes; per-verb `allowedRoles` on confirm;
  viewer/dispatcher blocks tested.
- Approvals: none|single|quorum (+auto quorum-2 on large transfers);
  expiry/reject/quorum paths in `decideApproval`.
- Idempotency: same key replays the stored run; races resolve to one row.
- Undo: corrections via `revert_user`; mfg via compensating re-runs;
  generic writes via audit-chain before-images (never deletes).
- Webhooks: `runPreCommitWebhooks` runs inside generic `executeAction`
  (wired this block — previously mfg-only); veto blocks with reason, audited
  as `action.webhook`.
- Board buttons: every definition carries label + params + criteria, and
  `actions/runner.tsx` already auto-generates the form (validate → preview
  → approve → idempotent execute). Boards embed the same runner (Phase F);
  no action-side work remains.
- Agent proposals: mfg verbs via `previewManufacturingAction`; generic
  actions via the preview route (propose-only, human confirms).
- Auto mode: `canAutoExecute` (actions.ts) is the choke point — only
  approval-free enabled actions eligible; served live on previews.
- Bulk: corrections family via `corrections-bulk.ts` (validate + per-row
  status); all actions accept client batching safely through idempotency keys.
- History: `OntoActionRun` per execution + hash-chained `action.executed`
  events; per-figure correction chains on the trail.
- Metrics: execution counts + approval rates on Ops; function latency rings
  for `$fn`-backed actions.
- Offline: `offline-queue.ts` (enqueue FIFO, idempotency dedupe, ordered
  drain through the governed executor, failures stay queued). Exe SQLite
  persistence lands with the desktop work; the contract is storage-agnostic.
- Kill check: `findUnusedActions` (enabled, never run).

## Per-action mapping (actions 1–22 + bulk_apply head)

| # | Action | Implementation |
|---|---|---|
| 1 | transfer_stock | mfg_transfer_stock: confirm, OWNER, quorum-2 over threshold |
| 2 | create_shipment | mfg_create_shipment: single approval, creates + decrements |
| 3 | reroute_shipment | mfg_reroute_shipment: confirm, OWNER |
| 4 | record_production | mfg_record_production: auto, OWNER+DISPATCHER, bitemporal fact |
| 5 | adjust_safety_stock | mfg_adjust_safety_stock: auto, OWNER+DISPATCHER |
| 6 | resolve_delay | mfg_resolve_delay: confirm + notify |
| 7 | reattribute_cost | corrections apply path (B-052): move cost load→load with reason |
| 8 | flag_figure | Correction propose with reason picker + text (B-051) |
| 9 | approve_correction | corrections/[id]/decide approve → notify + optional standing rule |
| 10 | reject_correction | decide reject → proposer notified, never silent |
| 11 | revert_user | bulk-revert any user's corrections in one action (B-060) |
| 12 | create_rule | standing rule from correction with past-weeks preview (B-054) |
| 13 | disable_rule | rule toggle; disable re-runs affected answers (B-055) |
| 14 | merge_objects | identity applyMergePlan (snapshots + audit) |
| 15 | unmerge_objects | identity applyUnmerge (restores snapshots) |
| 16 | propose_merge | identity proposeMerge review record (auto ≥0.92, review ≥0.7) |
| 17 | create_object | objects.createObject (required/coerce/unique enforced) |
| 18 | update_object | objects.upsertObject (merge-never-clobber, immutable enforced) |
| 19 | link_objects | edges.createEdgeInstance (OCC cardinality) |
| 20 | unlink_objects | edges.deleteEdgeInstance (precise triple delete) |
| 21 | record_fact | facts.recordFact (date validation, append-only) |
| 22 | stage_write | branch-store stageChange (same shape impact_sim simulates) |
| 23 | bulk_apply | corrections-bulk validate + per-row status (aspects 1–10 here) |
| 24 | notify_owner | `notifyOrg` (lib/core/notify.ts): approval-needed pings + decide outcomes; href into inbox |
| 25 | trigger_webhook | `deliverWebhook` (webhooks.ts): HMAC-signed POST, retries, dead-letter; tested |
| 26 | recompute_week | answers/recompute route: reruns affected weeks with corrections, before/after diff |
| 27 | export_answer | answers/export route: one-click CSV of the weekly answer |
| 28 | share_answer | answers/share POST: expiring read-only token link |
| 29 | revoke_share | answers/share DELETE (billing:manage): immediate revoke + audit |
| 30 | undo_action | `describeUndo` (execute.ts): compensating-action | revert | audit-restore plan per action family |
