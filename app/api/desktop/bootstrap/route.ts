import { NextResponse } from "next/server";
import { isDesktopMode, SESSION_COOKIE } from "@/lib/core/desktop";
import { ensureDesktopSession } from "@/lib/core/desktop-ident";
import { logAccess } from "@/lib/core/access";

// Desktop-only: no sign-in because the PC is the account. Sets the session
// cookie for this machine and redirects to the workspace. Repeated loads are
// idempotent (same machine → same org + user).
export async function GET(req: Request) {
  if (!isDesktopMode()) return NextResponse.json({ error: "not found" }, { status: 404 });
  const machine = process.env.MONAD_MACHINE_ID;
  if (!machine) return NextResponse.json({ error: "no machine identity on this server" }, { status: 503 });
  const { userId, orgId, sessionToken } = await ensureDesktopSession(machine);
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/workspace";
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/workspace";
  const res = NextResponse.redirect(new URL(dest, url.origin));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  await logAccess(orgId, userId, "desktop:bootstrap", dest).catch(() => undefined);
  return res;
}
