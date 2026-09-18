import type { PackManifest } from "@/lib/packs/manifest";

export const FREIGHT_MANIFEST: PackManifest = {
  id: "freight",
  name: "Freight — lane margins for carriers",
  version: 1,
  entities: ["load", "lane", "truck", "driver", "broker"],
  sources: ["tms", "fuel", "broker", "manual"],
  vocabulary: { group: "lane", groups: "lanes", record: "load", records: "loads", period: "week", money: "margin" },
  migrationNotes: ["v1: initial extraction from built-in freight paths; answers byte-identical by parity harness."],
};
