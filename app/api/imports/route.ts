import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrg } from "@/lib/org";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
  const cursor = url.searchParams.get("cursor");
  const runs = await db.importRun.findMany({
    where: { organizationId: active.organization.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { file: { select: { filename: true, bytes: true } } },
  });
  const nextCursor = runs.length > limit ? runs[runs.length - 1].id : null;
  return NextResponse.json({ runs: runs.slice(0, limit), nextCursor });
}
