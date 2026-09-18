import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getEnv } from "@/lib/core/env";
import { logger } from "@/lib/core/logger";

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? "none";
  const env = getEnv();
  let database: string = env.DATABASE_URL.includes("localhost") ? "unconfigured-check" : "configured";
  try {
    await db.$queryRaw`SELECT 1`;
    database = "reachable";
  } catch {
    database = "unreachable";
    logger.warn("health: database unreachable", { requestId });
  }
  return NextResponse.json({
    ok: database === "reachable",
    time: new Date().toISOString(),
    requestId,
    config: {
      database,
      googleOAuth: env.AUTH_GOOGLE_ID !== "" && env.AUTH_GOOGLE_SECRET !== "",
      emailLogin: env.AUTH_RESEND_KEY !== "",
      analytics: (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "") !== "",
      errorTracking: env.SENTRY_DSN !== "",
    },
  });
}
