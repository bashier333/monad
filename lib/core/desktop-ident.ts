import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/core/db";

// Machine identity: the exe reads the Windows MachineGuid (or a hostname
// fallback) and passes it as MONAD_MACHINE_ID. We hash it so the raw value
// never lands in storage.
export function normalizeMachineId(raw: string): string {
  return createHash("sha256").update(`monad-desktop:${raw.trim().toLowerCase()}`).digest("hex");
}

export function desktopEmail(machineId: string): string {
  return `desktop.${machineId.slice(0, 12)}@monad.local`;
}

function desktopOrgSlug(machineId: string): string {
  return `desktop-${machineId.slice(0, 8)}`;
}

const SESSION_DAYS = 365;

// One desktop org + one OWNER user per machine, auto-created from the
// machine identity. Returns the user and a fresh DB-backed session token for
// the first page load of the exe.
export async function ensureDesktopSession(machineRaw: string): Promise<{ userId: string; orgId: string; sessionToken: string }> {
  const machine = normalizeMachineId(machineRaw);
  const email = desktopEmail(machine);
  const slug = desktopOrgSlug(machine);

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({
      data: { email, name: "This machine", emailVerified: new Date() },
    });
  }

  let org = await db.organization.findUnique({ where: { slug } });
  if (!org) {
    org = await db.organization.create({
      data: { name: "Desktop", slug },
    });
  }

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
  });
  if (!membership) {
    await db.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
  } else if (membership.role !== "OWNER") {
    await db.membership.update({ where: { id: membership.id }, data: { role: "OWNER" } });
  }

  const sessionToken = randomBytes(32).toString("hex");
  await db.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  return { userId: user.id, orgId: org.id, sessionToken };
}
