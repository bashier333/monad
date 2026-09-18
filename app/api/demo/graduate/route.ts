import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/access";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const orgId = active.organization.id;
  const sampleFiles = await db.dataFile.findMany({
    where: { organizationId: orgId, filename: { startsWith: "sample-" } },
    select: { id: true },
  });
  const sampleRunIds = (
    await db.importRun.findMany({
      where: { organizationId: orgId, fileId: { in: sampleFiles.map((f) => f.id) } },
      select: { id: true },
    })
  ).map((r) => r.id);

  await db.importRowError.deleteMany({ where: { runId: { in: sampleRunIds } } });
  await db.stagedRecord.deleteMany({ where: { runId: { in: sampleRunIds } } });
  await db.importRun.deleteMany({ where: { id: { in: sampleRunIds } } });
  await db.dataFile.deleteMany({ where: { id: { in: sampleFiles.map((f) => f.id) } } });
  await logAccess(orgId, session.user.id, "demo:graduate", `${sampleRunIds.length} sample runs removed, mappings kept`);
  return NextResponse.json({ removed: sampleRunIds.length });
}
