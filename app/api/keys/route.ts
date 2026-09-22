import { NextResponse } from "next/server";
import { generateKey, parseScopes, API_KEY_SCOPES, KEY_TIERS } from "@/lib/core/apikeys";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { logAccess } from "@/lib/core/access";
import { requireJson } from "@/lib/core/json-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const keys = await db.apiKey.findMany({
    where: { orgId: active.organization.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, scopes: true, tier: true, revoked: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json({ keys, tiers: KEY_TIERS, scopes: API_KEY_SCOPES });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { name?: string; scopes?: unknown; tier?: string };
  const name = String(body.name ?? "api key").slice(0, 80);
  const scopes = parseScopes(body.scopes);
  if (scopes.length === 0) {
    return NextResponse.json({ error: `scopes required (one of ${API_KEY_SCOPES.join(", ")})` }, { status: 400 });
  }
  const tier = body.tier === "premium" ? "premium" : "standard";
  const { key, hash, prefix } = generateKey();
  const created = await db.apiKey.create({
    data: { orgId: active.organization.id, name, keyHash: hash, prefix, scopes, tier },
  });
  await logAccess(active.organization.id, session.user.id, "apikey:create", created.id);
  return NextResponse.json({ id: created.id, name, prefix, scopes, tier, key });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "billing:manage");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const guardedJson2 = requireJson(req);
  if (!guardedJson2.ok) return guardedJson2.response;
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const key = await db.apiKey.findFirst({ where: { id: body.id, orgId: active.organization.id } });
  if (!key) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.apiKey.update({ where: { id: key.id }, data: { revoked: true } });
  await logAccess(active.organization.id, session.user.id, "apikey:revoke", key.id);
  return NextResponse.json({ ok: true });
}
