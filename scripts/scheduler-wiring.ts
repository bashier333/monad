// Scheduler wiring: registers the pack-backed playbook executors and alert
// group providers into the core scheduler at worker startup. Scripts can
// import packs; core never does (boundary rule).
import { registerSchedulerWiring } from "../lib/core/scheduler";
import { alertGroupsFor, buildPlaybookExecutors } from "../lib/packs/playbook-executors";

export function registerManufacturingSchedulerWiring(): void {
  registerSchedulerWiring({
    playbookExecutors: async (orgId) => buildPlaybookExecutors(orgId),
    groups: async (orgId, pack) => alertGroupsFor(orgId, pack),
  });
}
