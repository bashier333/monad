import { NextResponse } from "next/server";
import { getWeeklyAnswer, resolveWeek } from "@/lib/answers/service";
import { buildExportCSV } from "@/lib/answers/csv";
import { auth } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org";

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
  const laneFilter = url.searchParams.get("lane");
  const answer = await getWeeklyAnswer(active.organization.id, active.organization.weekStartsOn, anchor);
  const csv = buildExportCSV(answer.lanes, answer.loads, laneFilter);
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
      "Content-Disposition": `attachment; filename="lane-margins-${answer.meta.weekStart}.csv"`,
    },
  });
}
