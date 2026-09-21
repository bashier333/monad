import { FREIGHT_ONTOLOGY } from "@/lib/packs/freight/ontology";
import { AGENCY_ONTOLOGY } from "@/lib/packs/agency/ontology";
import { createLink, createType } from "@/lib/core/ontology/registry";

const FIELD_KIND_TO_PROP: Record<string, string> = {
  date: "date",
  number: "number",
  string: "string",
};

function packToTypes(pack: { id: string; entities: string[]; fieldKinds: Record<string, string>; vocabulary: Record<string, string> }) {
  return pack.entities.map((entity) => ({
    key: `${pack.id}_${entity}`,
    label: entity,
    plural: entity.endsWith("s") ? entity : `${entity}s`,
    description: `Migrated from ${pack.id} pack constant`,
    properties: Object.entries(pack.fieldKinds).map(([field, kind]) => ({
      key: field,
      label: field,
      kind: FIELD_KIND_TO_PROP[kind] ?? "string",
      required: false,
      unique: false,
      indexed: true,
      immutable: false as const,
      config: undefined,
    })),
  }));
}

export async function seedPackConstants(organizationId: string, createdById: string) {
  const results: Array<{ pack: string; types: number; errors: string[] }> = [];
  for (const pack of [FREIGHT_ONTOLOGY, AGENCY_ONTOLOGY]) {
    const errors: string[] = [];
    let count = 0;
    for (const t of packToTypes(pack)) {
      const res = await createType(organizationId, createdById, t);
      if (res.ok) count += 1;
      else errors.push(`${t.key}: ${res.problems.map((p) => p.message).join("; ")}`);
    }
    const keys = pack.entities.map((e) => `${pack.id}_${e}`);
    if (pack.id === "freight") {
      const pairs: Array<[string, string, string]> = [
        ["freight_lane_loads", "freight_lane", "freight_load"],
        ["freight_load_truck", "freight_load", "freight_truck"],
        ["freight_load_driver", "freight_load", "freight_driver"],
        ["freight_load_broker", "freight_load", "freight_broker"],
      ];
      for (const [key, from, to] of pairs) {
        const res = await createLink(organizationId, { key, fromTypeKey: from, toTypeKey: to, cardinality: "one-many" });
        if (!res.ok) errors.push(`${key}: ${res.problems.map((p) => p.message).join("; ")}`);
      }
    }
    if (pack.id === "agency") {
      const pairs: Array<[string, string, string]> = [
        ["agency_project_revisions", "agency_project", "agency_revision"],
        ["agency_project_assets", "agency_project", "agency_asset"],
        ["agency_revision_approval", "agency_revision", "agency_approval"],
        ["agency_project_client", "agency_project", "agency_client"],
      ];
      for (const [key, from, to] of pairs) {
        const res = await createLink(organizationId, { key, fromTypeKey: from, toTypeKey: to, cardinality: "one-many" });
        if (!res.ok) errors.push(`${key}: ${res.problems.map((p) => p.message).join("; ")}`);
      }
    }
    void keys;
    results.push({ pack: pack.id, types: count, errors });
  }
  return results;
}
