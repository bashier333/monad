# Freight pack (E-093)

The reference pack: carrier lane-margin answers with full decision trails.

- Ontology: `lib/packs/freight/ontology.ts` (entities, measures, rules, sources, vocabulary)
- Engine: `margin/engine.ts` (deterministic, cent-exact) + `margin/places.ts` + `margin/rules.ts`
- Wiring: `service.ts` (inputs, corrections, answers, cache)
- Brief: `brief/build.ts` (delegates to `core/brief/summary.ts`) + `brief/variants.ts`
- Export: `csv.ts` · NL: `nl.ts` (config over `core/answers/nl.ts`)
- Demos: default + reefer/flatbed/dryvan sample packs
- Kill-gate metrics: trail queries/week, corrections→rules %, conversion (see /pilots)
