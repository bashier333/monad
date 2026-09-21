import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

// Batch object labels for explorers and consoles: ids in, keys out.
export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ objects: [] });
  const rows = await db.ontoObject.findMany({
    where: { organizationId: active.organization.id, id: { in: ids }, deletedAt: null },
    select: { id: true, key: true, typeKey: true },
  });
  return NextResponse.json({ objects: rows });
}
