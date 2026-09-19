import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { enqueueImport } from "@/lib/core/queue";
import { logger } from "@/lib/core/logger";
import { getActiveOrg } from "@/lib/core/org";
import { requireCan } from "@/lib/core/roles";
import { requireWritable } from "@/lib/core/guards";
import { saveBytes } from "@/lib/core/storage";

const PACKS: Record<string, Array<{ file: string; sourceType: string }>> = {
  default: [
    { file: "tms-week.csv", sourceType: "tms" },
    { file: "fuel-week.csv", sourceType: "fuel" },
    { file: "broker-statement.csv", sourceType: "broker" },
  ],
  reefer: [{ file: "demo-reefer.csv", sourceType: "tms" }],
  flatbed: [{ file: "demo-flatbed.csv", sourceType: "tms" }],
  dryvan: [{ file: "demo-dryvan.csv", sourceType: "tms" }],
  "agency-video": [
    { file: "agency-video-week.csv", sourceType: "time" },
    { file: "agency-invoices.csv", sourceType: "invoice" },
  ],
  "agency-design": [
    { file: "agency-design.csv", sourceType: "time" },
    { file: "agency-invoices.csv", sourceType: "invoice" },
  ],
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });
  try {
    requireCan(active.membership.role, "upload:import");
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const requestId = req.headers.get("x-request-id") ?? "none";
  const blocked = await requireWritable(active.organization.id);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const samples = PACKS[url.searchParams.get("pack") ?? ""] ?? PACKS.default;
  const runIds: string[] = [];
  for (const s of samples) {
    const bytes = await readFile(path.join(process.cwd(), "fixtures", s.file));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const existing = await db.dataFile.findFirst({
      where: { organizationId: active.organization.id, checksum },
      select: { id: true },
    });
    if (existing) continue;
    const storageKey = `${active.organization.id}/${checksum}.csv`;
    await saveBytes(storageKey, bytes);
    const file = await db.dataFile.create({
      data: {
        organizationId: active.organization.id,
        uploadedById: session.user.id,
        filename: `sample-${s.file}`,
        bytes: bytes.length,
        mime: "text/csv",
        checksum,
        storageKey,
        scannedOk: true,
      },
    });
    const run = await db.importRun.create({
      data: {
        organizationId: active.organization.id,
        fileId: file.id,
        uploadedById: session.user.id,
        sourceType: s.sourceType,
      },
    });
    runIds.push(run.id);
    await enqueueImport({ runId: run.id, requestId });
  }

  logger.info("demo seed requested", { requestId, orgId: active.organization.id, runs: runIds.length });
  if (runIds.length === 0) return NextResponse.json({ skipped: true });
  await logAccess(active.organization.id, session.user.id, "demo:seed", runIds.join(","), requestId);
  return NextResponse.json({ runs: runIds });
}
