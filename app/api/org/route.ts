import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { requireJson } from "@/lib/core/json-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberships = await db.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ orgs: memberships.map((m) => ({ ...m.organization, role: m.role })) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const guardedJson1 = requireJson(req);
  if (!guardedJson1.ok) return guardedJson1.response;
  const body = (await req.json()) as { name?: string; template?: string };
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const template = body.template === "agency" ? "agency" : body.template === "freight" ? "freight" : null;

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${createHash("sha256").update(`${session.user.id}:${Date.now()}`).digest("hex").slice(0, 6)}`;
  const org = await db.organization.create({ data: { name, slug } });
  await db.membership.create({ data: { userId: session.user.id, organizationId: org.id, role: "OWNER" } });
  await db.subscription.create({ data: { organizationId: org.id, tier: "free", status: "active" } });
  await logAccess(org.id, session.user.id, "org:create", name);

  let seeded: string[] = [];
  if (template) {
    const pack = template === "agency" ? "agency-video" : "default";
    const res = await fetch(`${new URL(req.url).origin}/api/demo/seed?pack=${pack}`, {
      method: "POST",
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    if (res.ok) seeded = [pack];
  }
  return NextResponse.json({ org: { id: org.id, name: org.name, slug: org.slug }, seeded });
}
