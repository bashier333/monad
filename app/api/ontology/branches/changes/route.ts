import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireJson } from "@/lib/core/json-guard";
import { requireWritable } from "@/lib/core/guards";
import { mergeBranch, stageChange } from "@/lib/core/ontology/branch-store";

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
  const body = (await req.json()) as {
    name?: string;
    change?: { objectId: string; baseVersion: number; data: Record<string, unknown> };
  };
  if (!body.name || !body.change) {
    return NextResponse.json({ error: "name and change are required" }, { status: 400 });
  }
  const res = await stageChange(active.organization.id, body.name, body.change);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(active.organization.id, userId, "ontology:branch:stage", body.name);
  return NextResponse.json({ branch: res.value });
}

export async function PUT(req: Request) {
  const session = await auth();
  const putUser = session?.user?.id;
  if (!putUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const putActive = await getActiveOrg(putUser);
  if (!putActive) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(putActive.membership.role, "ontology:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const blocked = await requireWritable(putActive.organization.id);
  if (blocked) return blocked;
  const body = (await req.json()) as { name?: string };
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const res = await mergeBranch(putActive.organization.id, putUser, body.name);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await logAccess(putActive.organization.id, putUser, "ontology:branch:merge", body.name);
  return NextResponse.json({ outcome: res.value });
}
