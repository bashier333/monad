import "@/lib/packs/freight/adapters";
import "@/lib/packs/agency/adapters";
import { FREIGHT_MANIFEST } from "@/lib/packs/freight/manifest";
import { AGENCY_MANIFEST } from "@/lib/packs/agency/manifest";
import { validatePackManifest, type PackManifest } from "@/lib/packs/manifest";
import { registeredSourceTypes } from "@/lib/core/ingest/adapters";

const MANIFESTS: PackManifest[] = [FREIGHT_MANIFEST, AGENCY_MANIFEST];

for (const m of MANIFESTS) {
  const problems = validatePackManifest(m);
  if (problems.length > 0) {
    throw new Error(`invalid pack manifest ${m.id}: ${problems.join("; ")}`);
  }
}

export function packManifests(): PackManifest[] {
  return MANIFESTS;
}

export function packsRegistered(): string[] {
  return registeredSourceTypes();
}
