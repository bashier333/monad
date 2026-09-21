import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { traverseLive } from "@/lib/core/ontology/edges";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(userId);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const startId = searchParams.get("startId") ?? "";
  if (!startId) return NextResponse.json({ error: "startId is required" }, { status: 400 });
  const depth = Math.min(Math.max(Number(searchParams.get("depth") ?? 2), 0), 4);
  const direction = searchParams.get("direction") === "in" || searchParams.get("direction") === "both"
    ? (searchParams.get("direction") as "in" | "both")
    : "out";
  const linkKeys = searchParams.get("links")?.split(",").map((s) => s.trim()).filter(Boolean);
  const res = await traverseLive(active.organization.id, startId, { maxDepth: depth, direction, linkKeys });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json(res.value);
}
