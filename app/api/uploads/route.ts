import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { scanBuffer } from "@/lib/ingest/scan";
import { enqueueImport } from "@/lib/queue";
import { auth } from "@/lib/auth";
import { FREE_LIMITS, getSubscription, monthlyUploads, recordUsage, toSubState } from "@/lib/billing";
import { db } from "@/lib/db";
import { logAccess } from "@/lib/access";
import { logger } from "@/lib/logger";
import { getActiveOrg } from "@/lib/org";
import { requireCan } from "@/lib/roles";
import { requireWritable } from "@/lib/guards";
import { saveBytes } from "@/lib/storage";

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
  const state = toSubState(await getSubscription(active.organization.id));
  if (state.tier === "free" && (await monthlyUploads(active.organization.id)) >= FREE_LIMITS.uploadsPerMonth) {
    return NextResponse.json({ error: "free tier: 10 uploads/month — upgrade to Team for unlimited" }, { status: 402 });
  }
  const form = await req.formData();
  const upload = form.get("file");
  const sourceType = String(form.get("sourceType") ?? "tms");
  if (!(upload instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const bytes = Buffer.from(await upload.arrayBuffer());
  const scan = scanBuffer(upload.name, bytes);
  if (!scan.ok) {
    return NextResponse.json({ error: scan.reason }, { status: 400 });
  }

  const checksum = createHash("sha256").update(bytes).digest("hex");
  const ext = upload.name.toLowerCase().endsWith(".xlsx") ? ".xlsx" : ".csv";
  const storageKey = `${active.organization.id}/${checksum}${ext}`;
  await saveBytes(storageKey, bytes);

  const file = await db.dataFile.create({
    data: {
      organizationId: active.organization.id,
      uploadedById: session.user.id,
      filename: upload.name,
      bytes: bytes.length,
      mime: scan.mime,
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
      sourceType,
    },
  });

  logger.info("upload accepted", { requestId, runId: run.id, file: upload.name, bytes: bytes.length });
  await recordUsage(active.organization.id, "upload");
  await logAccess(active.organization.id, session.user.id, "upload", upload.name);
  await enqueueImport({ runId: run.id, requestId });
  return NextResponse.json({ runId: run.id });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const active = await getActiveOrg(session.user.id);
  if (!active) return NextResponse.json({ error: "no organization" }, { status: 400 });

  const files = await db.dataFile.findMany({
    where: { organizationId: active.organization.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { runs: { select: { id: true, status: true, sourceType: true, createdAt: true } } },
  });
  return NextResponse.json({ files });
}
