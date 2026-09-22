import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { prismaConnectorStore } from "@/lib/core/ingest/connector";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  const take = Math.min(Math.max(Number.parseInt(url.searchParams.get("take") ?? "20", 10) || 20, 1), 100);
  const runs = await prismaConnectorStore.listSyncRuns(active.organization.id, take);
  await logAccess(active.organization.id, session.user.id, "sync:runs:list", "", req.headers.get("x-request-id") ?? "none");
  return NextResponse.json({ runs });
}
