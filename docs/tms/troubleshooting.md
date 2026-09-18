# Troubleshooting matrix (P-288)

| Symptom | Likely system | Fix |
|---|---|---|
| Revenue column empty for all rows | Export missing settlement column | Re-export with revenue/settlement included |
| Dates land in 1970/2099 | Serial dates or DD-MM vs MM-DD | Check date format; serials auto-parse |
| Every row quarantined DUPLICATE_KEY | Re-uploaded same file | Use merge/replace/skip decision |
| Mapping confidence all 0.6 | Exotic headers | Apply vendor preset, then hand-fix once |
| Fuel unattributed | Truck IDs don't match TMS units | Align truck/unit naming, add alias |
| Broker fees unmatched | LoadRef format differs from LoadID | Normalize refs, check casing/zeros |
| Import stuck PROCESSING | Worker died | POST /api/admin/sweep, or re-upload |
| Answer empty after good import | Week filter excludes dates | Check week picker vs file dates |
| Margin suddenly wrong | New rule or bad correction | Review adjustments list, disable suspect rule |
