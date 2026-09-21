import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { indexText, searchObjects } from "@/lib/core/ontology/search-nl";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const typeKey = searchParams.get("type") ?? undefined;
  if (q.trim().length < 2) return NextResponse.json({ hits: [] });
  const rows = await db.ontoObject.findMany({
    where: { organizationId: active.organization.id, deletedAt: null, ...(typeKey ? { typeKey } : {}) },
    select: { id: true, typeKey: true, key: true, data: true },
    take: 2000,
  });
  const hits = searchObjects(
    rows.map((r) => ({ id: r.id, typeKey: r.typeKey, key: r.key, text: indexText((r.data as Record<string, unknown>) ?? {}) })),
    q,
    { typeKey }
  );
  return NextResponse.json({ hits });
}
