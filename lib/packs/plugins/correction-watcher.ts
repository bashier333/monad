import { registerPlugin } from "@/lib/core/events";
import { logger } from "@/lib/core/logger";

// Example plugin 3: correction watcher — logs decided corrections for ops review.
registerPlugin({
  id: "correction-watcher",
  scopes: ["correction.decided"],
  hook: (event) => {
    logger.info("plugin:correction-watcher", { correctionId: event.payload.correctionId, status: event.payload.status });
  },
});
