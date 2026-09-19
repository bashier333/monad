import { NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/core/email";
import { db } from "@/lib/core/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("user");
  const token = url.searchParams.get("token");
  if (!userId || !token || !verifyUnsubscribe(userId, token)) {
    return NextResponse.json({ error: "invalid link" }, { status: 400 });
  }
  const resubscribe = url.searchParams.get("resubscribe") === "1";
  await db.user.update({ where: { id: userId }, data: { emailOptOut: !resubscribe } });
  return new NextResponse(
    resubscribe
      ? "<p>Resubscribed. You will receive brief emails again.</p>"
      : "<p>Unsubscribed. You will no longer receive brief emails.</p>",
    { headers: { "Content-Type": "text/html" } },
  );
}
