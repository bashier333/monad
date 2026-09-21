import { db } from "../lib/core/db";
import { twinGraph, twinOverview } from "../lib/packs/manufacturing/service";

async function main() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    console.log("no org");
    return;
  }
  const overview = await twinOverview(org.id);
  console.log("counts:", JSON.stringify(overview.counts));
  console.log("coverage:", JSON.stringify(overview.coverage));
  console.log("reorder:", JSON.stringify(overview.reorder));
  console.log("risks:", JSON.stringify(overview.risks));
  const graph = await twinGraph(org.id);
  console.log("graph nodes:", graph.nodes.map((n) => `${n.type}:${n.label}`).join(", "));
  console.log("graph edges:", JSON.stringify(graph.edges));
  const policies = await db.ontoPolicy.count({ where: { organizationId: org.id, typeKey: { startsWith: "mfg_" }, active: true } });
  console.log("mfg policies:", policies);
}

void main();
