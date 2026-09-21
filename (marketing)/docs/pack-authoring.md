# Pack-authoring guide v1 (E-100, from freight scars)

1. Declare ontology first (`ontology.ts`): entities, group key, measures, cost kinds,
   sources, rule IDs, field kinds, NL topics, presets, vocabulary. Validate it with a test.
2. Build the engine against core primitives (money/rounding in core, dates in core).
   Pin hand-computed cases before any UI.
3. Reuse core in order: ingest pipeline → corrections loop → summary primitives →
   notifications → billing. Write pack code only for what core lacks.
4. Ship fixtures + NL eval + demo seed with the pack (no pack merges without them).
5. Prove parity: new pack must not move freight numbers (full suite green).
6. Name things after the buyer's words (see freight vocabulary map), never ours.

## Human pack-review checklist (R-216, domain expert signs)

1. Ontology matches the buyer's words (shadow 1 operator call).
2. Fixtures are real shapes with fake numbers (5+ files, incl. messy/unicode/dup).
3. NL eval covers the top-10 buyer questions (green in CI).
4. Quarantine glossary readable by a non-engineer.
5. Demo seed loads in one click, graduates clean.
6. Generator improved from this pack's scars before the next one.
