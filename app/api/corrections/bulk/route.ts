import { NextResponse } from "next/server";
import { validateBulkRows, type BulkRow } from "@/lib/core/corrections-bulk";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";
import { requireJson } from "@/lib/core/json-guard";

export type { BulkRow };

export async function POST(req: Request) {
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

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { rows?: BulkRow[] };
  const parsed = validateBulkRows(body.rows);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const userId = session.user.id;
  const created = await db.correction.createMany({
    data: parsed.rows.map((row) => ({
      organizationId: active.organization.id,
      proposedById: userId,
      targetKey: row.targetKey!,
      field: row.field!,
      oldValue: row.oldValue ?? "",
      newValue: row.newValue ?? "EXCLUDE",
      reason: row.reason ?? "bulk import",
      status: "open" as const,
    })),
  });
  await logAccess(active.organization.id, userId, "corrections:bulk", String(created.count));
  return NextResponse.json({ ok: true, created: created.count });
}
