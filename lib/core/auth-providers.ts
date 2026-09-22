import type { Env } from "@/lib/core/env";

// Which sign-in options the UI may offer. Pure + tested: the client form
// receives booleans only, never secret names or values.
export interface ProviderFlags {
  github: boolean;
  google: boolean;
  email: boolean;
}

export function configuredProviders(env: Pick<Env, "AUTH_GITHUB_ID" | "AUTH_GITHUB_SECRET" | "AUTH_GOOGLE_ID" | "AUTH_GOOGLE_SECRET" | "AUTH_RESEND_KEY">): ProviderFlags {
  return {
    github: env.AUTH_GITHUB_ID !== "" && env.AUTH_GITHUB_SECRET !== "",
    google: env.AUTH_GOOGLE_ID !== "" && env.AUTH_GOOGLE_SECRET !== "",
    email: env.AUTH_RESEND_KEY !== "",
  };
}

// Post-login landing rule (used by the Auth.js redirect callback): a
// bare-origin callback means "no destination given" and must land members
// on the workspace — never the landing page, which reads as a failed
// sign-in. Relative and same-origin targets pass through; cross-origin
// targets fall back to the workspace (open-redirect safe).
export function resolvePostLoginRedirect(url: string, baseUrl: string): string {
  if (url === baseUrl || url === `${baseUrl}/` || url === "/") return `${baseUrl}/workspace`;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  if (url.startsWith(baseUrl)) return url;
  return `${baseUrl}/workspace`;
}
