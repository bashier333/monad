# Anomaly models (R-156/R-157/R-159)

## What it watches (model card, R-156)

Per group, per week: marginPct swing vs prior week. Learned threshold = max(3pts,
2σ of the group's own history) via `computeLearnedThresholds`; admin overrides
always win. Causes = top cost kinds + "dominated by X" over 60%.

## Cold start (R-157)

<3 weeks of history: fixed 6pt default, documented in the brief as "new group —
thresholds learn from week 3". No flags suppressed silently; new groups get the
same paragraph treatment.

## Fatigue guard (R-153)

Max 5 flags/week in the paragraph; the rest digest into one line pointing at the
anomalies view. Dismissing = suppression list = the feedback loop (R-154 note):
`anomalySuppressed` / `agencyAnomalySuppressed` teach the builder.

## Not built (honest)

Seasonality (R-152), A/B vs rule-based (R-158), quarterly review (R-160).
Multivariate margin+volume+cost (R-155): cost-kind causes only — volume is next.
