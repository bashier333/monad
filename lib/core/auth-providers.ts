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
