# Kill-gate review at pilot 3 (B-113)

Run this review with real numbers before writing another line of code.

## Queries (per pilot org)

```sql
-- trail queried weekly?
SELECT COUNT(*) FROM "MeterEvent"
WHERE "organizationId" = :org AND kind = 'answer_view'
  AND "createdAt" > NOW() - INTERVAL '7 days';

-- corrections becoming rules?
SELECT
  (SELECT COUNT(*) FROM "Correction" WHERE "organizationId" = :org AND status = 'applied') AS applied,
  (SELECT COUNT(*) FROM "StandingRule" WHERE "organizationId" = :org AND active) AS rules;

-- pilot criteria timestamps
SELECT "firstAnswerAt", "firstCorrectionAt", "meetingConfirmedAt", "convertedAt"
FROM "PilotChecklist" WHERE "organizationId" = :org;
```

(The same signals render live on `/pilots`.)

## Decision

- **GO** if ≥2 of 3 pilots query the trail weekly AND corrections→rules >30% AND ≥1 converted.
- **RE-SCOPE** (the decision, not the pitch) if the trail isn't queried: the memory isn't the moat
  for this workflow — pick the next decision from the plan's alternates.
- **KILL** if 0 convert after 4 weeks each: the pain isn't priced. Stop building.
