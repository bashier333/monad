import { registerPlugin } from "@/lib/core/events";
import { logger } from "@/lib/core/logger";

// Example plugin 2: import stats — counts completed imports per org (in-memory, sandboxed).
const counts = new Map<string, number>();

registerPlugin({
  id: "import-stats",
  scopes: ["import.completed"],
  hook: (event) => {
    const n = (counts.get(event.orgId) ?? 0) + 1;
    counts.set(event.orgId, n);
    logger.info("plugin:import-stats", { orgId: event.orgId, imports: n });
  },
});

export function importStats(orgId: string): number {
  return counts.get(orgId) ?? 0;
}
