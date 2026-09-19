import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { db } from "@/lib/core/db";
import { getEnv } from "@/lib/core/env";

const env = getEnv();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
    Resend({ apiKey: env.AUTH_RESEND_KEY, from: env.EMAIL_FROM }),
  ],
  events: {
    async signIn({ user }) {
      try {
        if (!user.id) return;
        const membership = await db.membership.findFirst({
          where: { userId: user.id },
          select: { organizationId: true },
        });
        if (membership) {
          const { logAccess } = await import("@/lib/core/access");
          await logAccess(membership.organizationId, user.id, "auth:signin", "");
        }
      } catch {
        // login history must never break sign-in
      }
    },
    async signOut(message) {
      try {
        const userId = (message as { session?: { userId?: string } })?.session?.userId;
        if (!userId) return;
        const membership = await db.membership.findFirst({
          where: { userId },
          select: { organizationId: true },
        });
        if (membership) {
          const { logAccess } = await import("@/lib/core/access");
          await logAccess(membership.organizationId, userId, "auth:signout", "");
        }
      } catch {
        // logout must never break
      }
    },
  },
});
