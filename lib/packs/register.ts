import "@/lib/packs/freight/adapters";
import "@/lib/packs/agency/adapters";
import { registeredSourceTypes } from "@/lib/core/ingest/adapters";

export function packsRegistered(): string[] {
  return registeredSourceTypes();
}
