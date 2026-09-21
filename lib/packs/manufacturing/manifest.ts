import type { PackManifest } from "@/lib/packs/manifest";

export const MANUFACTURING_MANIFEST: PackManifest = {
  id: "manufacturing",
  name: "Manufacturing operational model",
  version: 1,
  entities: ["plant", "warehouse", "product", "inventory_lot", "shipment", "customer"],
  sources: ["erp", "wms", "mes"],
  vocabulary: {
    group: "plant",
    groups: "plants",
    record: "inventory_lot",
    records: "inventory lots",
    period: "week",
    money: "unit_value",
  },
  migrationNotes: [
    "v1: manufacturing domain on the generic ontology engine - 6 object types, 7 links, 6 governed actions.",
    "Reads are policy-enforced (deny by default); the seed writes one allow-all policy per type so the twin is usable out of the box.",
  ],
};
