import { NextResponse } from "next/server";
import { getWeeklyAnswer } from "@/lib/packs/freight/service"; import { resolveWeek } from "@/lib/core/answers/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { buildExportCSV } from "@/lib/packs/freight/csv";
import { buildAgencyExportCSV } from "@/lib/packs/agency/csv";
import { auth } from "@/lib/core/auth";
import { getActiveOrg } from "@/lib/core/org";
import { logAccess } from "@/lib/core/access";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const url = new URL(req.url);
  let anchor: string;
  try {
    anchor = resolveWeek(url.searchParams.get("week"));
  } catch {
    return NextResponse.json({ error: "invalid week parameter (use YYYY-MM-DD)" }, { status: 400 });
  }
  const pack = url.searchParams.get("pack") === "agency" ? "agency" : "freight";
  const filenamePack = pack === "agency" ? "agency" : "lane-margins";

  let csv: string;
  let weekStart: string;
  if (pack === "agency") {
    const projectFilter = url.searchParams.get("project");
    const answer = await getAgencyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
    const loads = answer.projects.flatMap((p) => p.loads);
    csv = buildAgencyExportCSV(answer.projects, loads, projectFilter);
    weekStart = answer.meta.weekStart;
  } else {
    const laneFilter = url.searchParams.get("lane");
    const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
    csv = buildExportCSV(answer.lanes, answer.loads, laneFilter);
    weekStart = answer.meta.weekStart;
  }
  await logAccess(active.organization.id, session.user.id, "export", `${pack}:${weekStart}`);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const CHUNK = 65536;
      for (let i = 0; i < csv.length; i += CHUNK) {
        controller.enqueue(encoder.encode(csv.slice(i, i + CHUNK)));
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filenamePack}-${weekStart}.csv"`,
    },
  });
}
