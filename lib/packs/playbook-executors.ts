import { notifyOrg } from "@/lib/core/notify";
import { exportTypeSet } from "@/lib/core/ontology/registry";
import { weekBounds } from "@/lib/core/dates";
import type { GroupLite } from "@/lib/core/workflow";
import { twinGraph, twinOverview } from "@/lib/packs/manufacturing/service";
import { buildMfgBrief, buildMfgBriefVariants } from "@/lib/packs/manufacturing/brief/build";
import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";

export interface RealPlaybookExecutors {
  brief: () => Promise<string>;
  notify: (message: string) => Promise<string>;
  export: () => Promise<string>;
}

function anchorISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekOf(): { start: string; end: string } {
  const { start, end } = weekBounds(anchorISO(), 1);
  return { start, end };
}

// Real playbook step executors shared by the API route (manual runs) and the
// scheduler (automatic runs). Briefs build computed summaries and notify the
// org; exports record the ontology type-set into the run log.
export function buildPlaybookExecutors(orgId: string): RealPlaybookExecutors {
  return {
    brief: async () => {
      const overview = await twinOverview(orgId);
      if (overview.counts.lots > 0) {
        const { start, end } = weekOf();
        const base = buildMfgBrief(overview, start, end);
        const { nodes } = await twinGraph(orgId);
        const brief = buildMfgBriefVariants(overview, base, nodes);
        await notifyOrg(orgId, "playbook", brief.parts.join(" "), "/ontology/twin");
        return `manufacturing brief: week of ${start}, ${brief.parts.length} parts`;
      }
      const a = await getWeeklyAnswer(orgId, 1, anchorISO());
      const summary = `Week: ${a.totals.loads} loads, margin ${a.totals.margin}.`;
      await notifyOrg(orgId, "playbook", summary, "/answers");
      return `freight brief: ${summary}`;
    },
    notify: async (message: string) => {
      await notifyOrg(orgId, "playbook", message, "/answers");
      return `notified: ${message.slice(0, 120)}`;
    },
    export: async () => {
      const exp = await exportTypeSet(orgId);
      return `exported ${exp.types.length} types, ${exp.links.length} links`;
    },
  };
}

export async function alertGroupsFor(orgId: string, pack: string): Promise<GroupLite[] | null> {
  if (pack === "manufacturing") {
    const overview = await twinOverview(orgId);
    return overview.coverage.map((c) => ({
      key: c.key,
      margin: 0,
      cost: 0,
      coverage: c.coverageDays ?? undefined,
    }));
  }
  if (pack === "freight") {
    const a = await getWeeklyAnswer(orgId, 1, anchorISO());
    return a.lanes.map((l) => ({ key: l.lane, margin: l.margin, cost: l.cost }));
  }
  if (pack === "agency") {
    const a = await getAgencyAnswer(orgId, 1, anchorISO());
    return a.projects.map((p) => ({ key: p.project, margin: p.margin, cost: p.cost }));
  }
  return null;
}
