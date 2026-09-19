# Data catalog (R-961)

Every table, owner, purpose. Owner: eng unless noted.

| Table | Purpose | PII? | Retention |
|---|---|---|---|
| Organization / Membership / User | tenancy, roles | emails | org lifetime + 30d grace |
| DataFile / ImportRun / StagedRecord / ImportRowError | ingest pipeline | file contents (operator data) | tier policy |
| ColumnMapping | mapping memory per shape | no | org lifetime |
| Correction / StandingRule | decision trail | reasons (free text) | 7y, queryable |
| Notification | bell + digests | titles | 90d hot |
| AnswerShare | read-only links | none | 30d expiry |
| Brief (+feedback) | Monday briefs + votes | feedback notes | 13mo |
| Subscription / MeterEvent | billing + usage | none | 7y |
| AccessLog | audit trail | user ids | 7y |
| PlaceAlias | name normalization | no | org lifetime |
| PilotChecklist | concierge tracking | operator notes | pilot lifetime |
| EventLog | domain events (append-only) | payloads (operator data) | hot 90d, cold 1y |
| WebhookEndpoint | webhook-out subscriptions | urls | org lifetime |
| ApiKey | v2 access (hashes only) | none | until revoked |
| AlertRule | margin alerts | none | until deleted |
| WorkflowPlaybook / WorkflowRun | playbooks + history | none | 90d hot |
| OrgDeletion | deletion grace queue | none | 30d then purge |

## Quality SLAs (R-962)

Critical datasets (answers inputs, billing meters): validated at ingest
(quarantine codes), parity-harness pinned, sampled weekly. Definitions live in
`docs/units.md` + engine tests — one meaning per metric, no metric chaos (R-967).

## PII standard (R-963)

Minimize (only columns the pack needs), encrypt in transit/at rest (platform),
audit every access (AccessLog). Exports carry only the requesting org's rows.

## Steward + reviews (R-969/R-970)

Steward: eng lead until named otherwise. Quarterly review: calendar item.
