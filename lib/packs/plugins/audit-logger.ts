import { registerPlugin } from "@/lib/core/events";
import { logger } from "@/lib/core/logger";

// Example plugin 1: audit logger — logs every event to the app log.
registerPlugin({
  id: "audit-logger",
  scopes: ["*"],
  hook: (event) => {
    logger.info("plugin:audit-logger", { type: event.type, orgId: event.orgId, pack: event.pack, payload: event.payload });
  },
});
