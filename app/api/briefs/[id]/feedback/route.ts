import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const brief = await db.brief.findFirst({
    where: { id, organizationId: active.organization.id },
  });
  if (!brief) return NextResponse.json({ error: "not found" }, { status: 404 });

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { up?: boolean; note?: string; week?: string };
  const note = String(body.note ?? "").slice(0, 2000);
  if (body.up === false && note.trim() === "") {
    return NextResponse.json({ error: "tell us what was wrong (one line)" }, { status: 400 });
  }
  const existing = (brief.feedback ?? []) as Array<Record<string, unknown>>;
  const feedback = [
    ...existing,
    { userId: session.user.id, up: body.up !== false, note, at: new Date().toISOString() },
  ];
  await db.brief.update({
    where: { id },
    data: { feedback: feedback as unknown as Prisma.InputJsonValue },
  });
  await logAccess(active.organization.id, session.user.id, "brief:feedback", id, req.headers.get("x-request-id") ?? "none");
  if (body.up === false) {
    await db.correction.create({
      data: {
        organizationId: active.organization.id,
        targetType: "brief",
        targetKey: `brief:${brief.weekStart}`,
        field: "brief",
        oldValue: "",
        newValue: "",
        reason: `thumbs-down on ${brief.weekStart} brief: ${note}`,
        proposedById: session.user.id,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
