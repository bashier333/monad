import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getSubscription } from "@/lib/core/billing";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { deleteOrgData, EXPORT_SCHEMA_VERSION } from "@/lib/core/org-data";
import { requireCan } from "@/lib/core/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const orgId = active.organization.id;
  const sub = await getSubscription(orgId);
  const rowTake = sub.tier === "free" ? 50_000 : 200_000;
  const [staged, mappings, aliases, corrections, rules, briefs, runs] = await Promise.all([
    db.stagedRecord.findMany({ where: { organizationId: orgId }, take: rowTake }),
    db.columnMapping.findMany({ where: { organizationId: orgId } }),
    db.placeAlias.findMany({ where: { organizationId: orgId } }),
    db.correction.findMany({ where: { organizationId: orgId } }),
    db.standingRule.findMany({ where: { organizationId: orgId } }),
    db.brief.findMany({ where: { organizationId: orgId } }),
    db.importRun.findMany({ where: { organizationId: orgId }, include: { file: true } }),
  ]);

  const body = JSON.stringify(
    { schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: new Date().toISOString(), orgId, staged, mappings, aliases, corrections, rules, briefs, runs },
    null,
    2,
  );
  const checksum = createHash("sha256").update(body).digest("hex");
  await logAccess(orgId, session.user.id, "org:export", checksum.slice(0, 16));

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="export-${active.organization.slug}.json"`,
      "X-Export-Checksum": checksum,
    },
  });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== active.organization.slug) {
    return NextResponse.json({ error: "confirm with your organization slug" }, { status: 400 });
  }

  const orgId = active.organization.id;
  await deleteOrgData(orgId);
  await logAccess(orgId, session.user.id, "org:delete-everything", active.organization.slug);

  return NextResponse.json({ ok: true });
}
