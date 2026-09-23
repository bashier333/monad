import { randomBytes } from "node:crypto";
import { db } from "@/lib/core/db";

// First-login provisioning: a brand-new OAuth user has a session but no
// organization, and every product page gates on getActiveOrg(). Without this
// they land on "Sign in to open the workspace" right after signing in.
// Idempotent: users that already have a membership are untouched.
export function personalSlugBase(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  const clean = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return clean || "workspace";
}

export function personalOrgName(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0] ?? "";
  return local ? `${local}'s workspace` : "My workspace";
}

export async function ensurePersonalOrg(userId: string, email: string | null | undefined): Promise<string> {
  const existing = await db.membership.findFirst({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.organizationId;

  const base = personalSlugBase(email);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = `${base}-${randomBytes(3).toString("hex")}`;
    try {
      const org = await db.organization.create({
        data: { name: personalOrgName(email), slug },
        select: { id: true },
      });
      await db.membership.create({
        data: { userId, organizationId: org.id, role: "OWNER" },
      });
      return org.id;
    } catch (e) {
      // Slug collision under concurrency: retry with a fresh suffix.
      // Anything else (or a repeated membership) falls through to re-read.
      if ((e as { code?: string })?.code !== "P2002") break;
    }
  }
  const again = await db.membership.findFirst({
    where: { userId },
    select: { organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!again) throw new Error("provision: no membership after create");
  return again.organizationId;
}
