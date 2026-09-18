import { NextResponse } from "next/server";
import { resolveWeek } from "@/lib/core/answers/service";
import { buildVariant, type VariantBy } from "@/lib/packs/freight/brief/variants";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

const VARIANTS: VariantBy[] = ["driver", "truck", "broker", "customer", "day", "month"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const by = url.searchParams.get("by") as VariantBy;
  const key = url.searchParams.get("key") ?? "";
  if (!VARIANTS.includes(by) || !key) {
    return NextResponse.json({ error: "by must be driver|truck|broker|customer|day|month with a key" }, { status: 400 });
  }
  let anchor: string;
  try {
    anchor = resolveWeek(url.searchParams.get("week"));
  } catch {
    return NextResponse.json({ error: "invalid week parameter" }, { status: 400 });
  }

  const openCorrections = await db.correction.count({
    where: { organizationId: active.organization.id, status: "open" },
  });
  const content = await buildVariant(active.organization.id, active.organization.weekStartsOn, anchor, by, key, openCorrections);
  return NextResponse.json({ content });
}
