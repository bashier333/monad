# Wrong-answer postmortem (B-092) — file one per pilot-reported wrong figure

## What was wrong

Figure, week, expected vs shown, who reported it.

## Root cause (one of)

- [ ] Import: bad source data, wrong mapping, quarantined row that mattered
- [ ] Rule: attribution rule misfired (which rule ID?)
- [ ] Mapping: alias missing or wrong (which place?)
- [ ] Correction: a bad correction or rule poisoned it (which ID?)
- [ ] Engine: computation bug (link failing/added test)

## Fix + prevention

- Immediate: correction applied? rule disabled? re-upload?
- Permanent: fixture added? eval case added? code changed (link PR)?

## Who owns follow-up, and by when
