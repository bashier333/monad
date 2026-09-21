import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().default("postgresql://monad:monad@localhost:5432/monad"),
  AUTH_SECRET: z.string().default("dev-only-secret-replace-me"),
  AUTH_URL: z.string().default("http://localhost:3000"),
  AUTH_GOOGLE_ID: z.string().default(""),
  AUTH_GOOGLE_SECRET: z.string().default(""),
  AUTH_GITHUB_ID: z.string().default(""),
  AUTH_GITHUB_SECRET: z.string().default(""),
  AUTH_RESEND_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("login@example.com"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_TEAM_PRICE_ID: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function checkProductionSecrets(e: { AUTH_SECRET?: string; NODE_ENV?: string }): string | null {
  if (e.NODE_ENV === "production" && (!e.AUTH_SECRET || e.AUTH_SECRET === "dev-only-secret-replace-me" || e.AUTH_SECRET.length < 32)) {
    return "AUTH_SECRET must be a real ≥32-char secret in production";
  }
  return null;
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("[env] invalid environment, using dev defaults:", parsed.error.flatten().fieldErrors);
    cached = schema.parse({});
    return cached;
  }
  cached = parsed.data;
  const problem = checkProductionSecrets({ AUTH_SECRET: cached.AUTH_SECRET, NODE_ENV: cached.NODE_ENV });
  if (problem) {
    throw new Error(`[env] ${problem}`);
  }
  return cached;
}
