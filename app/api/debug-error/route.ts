import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const requestId = req.headers.get("x-request-id") ?? "none";
  logger.error("debug-error endpoint hit", { requestId, test: true });
  throw new Error("intentional dev-only test error");
}
