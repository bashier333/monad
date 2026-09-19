import { NextResponse } from "next/server";
import { bustAliasCache, bustAnswerCache } from "@/lib/core/answers/service";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const aliases = await db.placeAlias.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { alias: "asc" },
    take: 500,
  });
  return NextResponse.json({ aliases });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "rule:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { alias?: string; canonical?: string };
  if (!body.alias || !body.canonical) {
    return NextResponse.json({ error: "alias and canonical are required" }, { status: 400 });
  }
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const created = await db.placeAlias.upsert({
    where: {
      organizationId_alias: { organizationId: active.organization.id, alias: norm(body.alias) },
    },
    update: { canonical: norm(body.canonical) },
    create: {
      organizationId: active.organization.id,
      alias: norm(body.alias),
      canonical: norm(body.canonical),
      createdById: session.user.id,
    },
  });
  bustAliasCache(active.organization.id);
  bustAnswerCache(active.organization.id);
  await logAccess(active.organization.id, session.user.id, "alias:save", norm(body.alias));
  return NextResponse.json({ alias: created });
}
