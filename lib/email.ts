import { createHmac } from "crypto";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Promise<boolean> {
  const env = getEnv();
  if (!env.AUTH_RESEND_KEY) {
    logger.info("email skipped (no Resend key)", { requestId, to, subject });
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AUTH_RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject, html, headers: extraHeaders }),
  });
  if (!res.ok) {
    logger.error("email send failed", { requestId, to, status: res.status });
    return false;
  }
  return true;
}

export function signUnsubscribe(userId: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`unsub:${userId}`).digest("hex");
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  return signUnsubscribe(userId) === token;
}

export function unsubscribeUrl(origin: string, userId: string): string {
  return `${origin}/api/email/unsubscribe?user=${userId}&token=${signUnsubscribe(userId)}`;
}
