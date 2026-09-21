import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { seedManufacturingPack } from "@/lib/packs/manufacturing/service";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as { pack?: string };
  if (body.pack !== undefined && body.pack !== "manufacturing") {
    return NextResponse.json({ error: 'only pack "manufacturing" can be seeded here' }, { status: 400 });
  }
  const res = await seedManufacturingPack(active.organization.id, userId);
  await logAccess(active.organization.id, userId, "ontology:pack:seed", "manufacturing");
  return NextResponse.json(res);
}
