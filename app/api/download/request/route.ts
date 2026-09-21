import { NextResponse } from "next/server";
import { auth } from "@/lib/core/auth";
import { logAccess } from "@/lib/core/access";
import { getActiveOrg } from "@/lib/core/org";
import { requireJson } from "@/lib/core/json-guard";
import { sendEmail } from "@/lib/core/email";
import { getEnv } from "@/lib/core/env";
import { logger } from "@/lib/core/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const guarded = requireJson(req);
  if (!guarded.ok) return guarded.response;
  const body = (await req.json()) as { email?: string; use?: string };
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 160) : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "a valid work email is required" }, { status: 400 });
  }
  const use = typeof body.use === "string" ? body.use.trim().slice(0, 300) : "";
  const session = await auth();
  const userId = session?.user?.id ?? "anonymous";
  let organizationId = "";
  if (session?.user?.id) {
    const active = await getActiveOrg(session.user.id);
    if (active) organizationId = active.organization.id;
  }
  const env = getEnv();
  const requestId = crypto.randomUUID();
  logger.info("download request", { requestId, email, use: use || undefined, userId });
  let notified = false;
  if (env.AUTH_RESEND_KEY && env.EMAIL_FROM) {
    notified = await sendEmail(
      env.EMAIL_FROM,
      `Engine access request: ${email}`,
      `<p>Engine access request from ${email}.</p><p>Use: ${use || "not given"}</p>`,
      requestId,
      {},
      `Engine access request from ${email}. Use: ${use || "not given"}`
    );
  }
  if (organizationId) {
    await logAccess(organizationId, userId, "download:request", email);
  }
  return NextResponse.json({ received: true, notified });
}
