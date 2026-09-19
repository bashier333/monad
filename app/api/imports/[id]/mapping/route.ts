import { NextResponse } from "next/server";
import { sanitizeMapping } from "@/lib/core/imports/validate";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const run = await db.importRun.findFirst({
    where: { id, organizationId: active.organization.id },
  });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;

  const body = (await req.json()) as { mapping?: Record<string, number | null> };
  const headers = (run.headers ?? []) as string[];
  const parsed = sanitizeMapping(headers.length, body.mapping ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await db.importRun.update({ where: { id }, data: { mapping: parsed.mapping } });
  await logAccess(active.organization.id, session.user.id, "import:mapping", id, req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ ok: true });
}
