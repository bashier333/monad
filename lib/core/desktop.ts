// Desktop (exe) mode: the Electron shell spawns the server with
// MONAD_DESKTOP=1. In this mode the marketing site is hidden (rewritten to
// the workspace home) and the ontology shell replaces the website chrome.
// Web deployments never set the flag, so they are unaffected.
// This module is edge-safe (no node: imports) because middleware imports it.

export function isDesktopMode(): boolean {
  return process.env.MONAD_DESKTOP === "1";
}

// Desktop identity: in exe mode the PC is the account, so cookie-less full
// page loads bootstrap a session once and skip sign-in entirely.
export function desktopBootstrapPath(
  pathname: string,
  accept: string,
  cookieHeader: string
): { path: string } | null {
  if (!isDesktopMode()) return null;
  const hasSession = cookieHeader.split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
  if (hasSession) return null;
  const isPageLoad =
    !pathname.startsWith("/api/") && !pathname.startsWith("/_next") && accept.includes("text/html");
  if (!isPageLoad) return null;
  if (pathname === "/api/desktop/bootstrap") return null;
  return { path: "/api/desktop/bootstrap" };
}

const MARKETING_PATHS = ["/", "/platforms", "/download", "/model"];

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Returns the rewrite target for marketing pages in desktop mode, or null
// when no rewrite applies. API routes, static assets, and app pages pass
// through untouched.
export function desktopRewrite(pathname: string): string | null {
  if (!isDesktopMode()) return null;
  if (!isMarketingPath(pathname)) return null;
  return "/workspace";
}

// NextAuth v5 database-session cookie name (insecure http localhost).
export const SESSION_COOKIE = "authjs.session-token";
