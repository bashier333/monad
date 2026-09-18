import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  providers: [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
    Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.EMAIL_FROM }),
  ],
});
