import { NextResponse } from "next/server";
import { parseStatusFilter } from "@/lib/core/imports/validate";
import { requireJson } from "@/lib/core/json-guard";
import { logAccess } from "@/lib/core/access";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { stampFirstCorrection } from "@/lib/core/pilots";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "correction:propose");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as {
    targetKey?: string;
    targets?: Array<{ targetKey?: string; field?: string }>;
    field?: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
  };
  const targets = Array.isArray(body.targets) && body.targets.length > 0
    ? body.targets
    : [{ targetKey: body.targetKey, field: body.field }];
  if (targets.length > 100) {
    return NextResponse.json({ error: "at most 100 targets per request" }, { status: 400 });
  }
  for (const t of targets) {
    if (!t.targetKey || !t.field) {
      return NextResponse.json({ error: "every target needs targetKey and field" }, { status: 400 });
    }
    if (String(t.targetKey).length > 200 || String(t.field).length > 80) {
      return NextResponse.json({ error: "targetKey (max 200) / field (max 80) too long" }, { status: 400 });
    }
  }
  const reason = String(body.reason ?? "").slice(0, 5000);
  const oldValue = String(body.oldValue ?? "").slice(0, 2000);
  const newValue = String(body.newValue ?? "").slice(0, 200);
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const proposerId = session.user.id;
  const requestId = req.headers.get("x-request-id") ?? "none";

  const created = await db.$transaction(
    targets.map((t) =>
      db.correction.create({
        data: {
          organizationId: active.organization.id,
          targetKey: String(t.targetKey),
          field: String(t.field),
          oldValue,
          newValue,
          reason,
          proposedById: proposerId,
        },
      }),
    ),
  );
  await stampFirstCorrection(active.organization.id);
  await logAccess(active.organization.id, proposerId, "correction:propose", String(created.length), requestId);
  return NextResponse.json({ corrections: created });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const status = parseStatusFilter(url.searchParams.get("status"));
  const proposedBy = url.searchParams.get("proposedBy");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 500);
  const cursor = url.searchParams.get("cursor");
  const corrections = await db.correction.findMany({
    where: {
      organizationId: active.organization.id,
      ...(status === "all" ? {} : { status }),
      ...(proposedBy ? { proposedById: proposedBy } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = corrections.length > limit ? corrections[corrections.length - 1].id : null;
  return NextResponse.json({ corrections: corrections.slice(0, limit), nextCursor });
}
