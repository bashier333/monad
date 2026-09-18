import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

function cell(v: string): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const run = await db.importRun.findFirst({
    where: { id, organizationId: active.organization.id },
    include: { rowErrors: { orderBy: { rowNumber: "asc" }, take: 500 } },
  });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lines = ["row,code,message"];
  for (const e of run.rowErrors) {
    for (const issue of e.errors as Array<{ code: string; message: string }>) {
      lines.push([String(e.rowNumber), issue.code, issue.message].map(cell).join(","));
    }
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="import-errors-${id.slice(0, 8)}.csv"`,
    },
  });
}
