import { NextResponse } from "next/server";
import { packManifests } from "@/lib/packs/register";
import { packEnabled } from "@/lib/core/packs";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const settings = (active.organization.settings ?? {}) as Record<string, unknown>;
  const packs = packManifests().map((m) => ({
    id: m.id,
    name: m.name,
    version: m.version,
    entities: m.entities,
    vocabulary: m.vocabulary,
    enabled: packEnabled(settings, m.id),
  }));
  return NextResponse.json({ packs });
}
