import { AGENCY_ONTOLOGY } from "@/lib/packs/agency/ontology";
import type { PackManifest } from "@/lib/packs/manifest";

export const AGENCY_MANIFEST: PackManifest = {
  id: "agency",
  name: "Studio — project margins for video agencies",
  version: 1,
  entities: [...AGENCY_ONTOLOGY.entities],
  sources: AGENCY_ONTOLOGY.sources.map((s) => s.type),
  vocabulary: { ...AGENCY_ONTOLOGY.vocabulary },
  migrationNotes: ["v1: greenfield pack; no migrations yet."],
};
