import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import {
  deleteOrgKey,
  isOrgKeyProvider,
  orgKeyStatus,
  saveOrgKey,
} from "@/lib/core/agent/org-keys";

async function ownerOrgId() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const active = await getActiveOrg(userId);
  if (!active) return { error: NextResponse.json({ error: "no organization" }, { status: 400 }) };
  if (active.membership.role !== "OWNER") {
    return { error: NextResponse.json({ error: "owners only" }, { status: 403 }) };
  }
  return { orgId: active.organization.id };
}

// GET: which provider keys this workspace has (hints only, never secrets).
export async function GET() {
  const res = await ownerOrgId();
  if ("error" in res) return res.error;
  return NextResponse.json({ keys: await orgKeyStatus(res.orgId) });
}

// POST { provider, key }: save (or replace) a workspace AI key.
export async function POST(req: Request) {
  const res = await ownerOrgId();
  if ("error" in res) return res.error;
  const guard = requireJson(req);
  if (!guard.ok) return guard.response;
  const body = (await req.json()) as { provider?: unknown; key?: unknown };
  if (!isOrgKeyProvider(body.provider)) {
    return NextResponse.json({ error: "provider must be nvidia, anthropic, or openai" }, { status: 400 });
  }
  if (typeof body.key !== "string" || body.key.trim().length < 8) {
    return NextResponse.json({ error: "key looks too short" }, { status: 400 });
  }
  try {
    const { hint } = await saveOrgKey(res.orgId, body.provider, body.key);
    return NextResponse.json({ ok: true, provider: body.provider, hint });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "save failed" }, { status: 500 });
  }
}

// DELETE { provider }: remove a workspace AI key (falls back to server key).
export async function DELETE(req: Request) {
  const res = await ownerOrgId();
  if ("error" in res) return res.error;
  const guard = requireJson(req);
  if (!guard.ok) return guard.response;
  const body = (await req.json()) as { provider?: unknown };
  if (!isOrgKeyProvider(body.provider)) {
    return NextResponse.json({ error: "provider must be nvidia, anthropic, or openai" }, { status: 400 });
  }
  await deleteOrgKey(res.orgId, body.provider);
  return NextResponse.json({ ok: true });
}
