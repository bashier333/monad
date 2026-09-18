import { PrismaClient, Role } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const org = await db.organization.upsert({
    where: { slug: "demo-carrier" },
    update: {},
    create: {
      name: "Demo Carrier Co.",
      slug: "demo-carrier",
      weekStartsOn: 1,
      timezone: "America/Chicago",
    },
  });

  const people: Array<{ email: string; name: string; role: Role }> = [
    { email: "owner@democarrier.test", name: "Dana Owner", role: Role.OWNER },
    { email: "dispatcher@democarrier.test", name: "Deshawn Dispatcher", role: Role.DISPATCHER },
    { email: "viewer@democarrier.test", name: "Vera Viewer", role: Role.VIEWER },
  ];

  for (const p of people) {
    const user = await db.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { email: p.email, name: p.name },
    });
    await db.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
      update: { role: p.role },
      create: { userId: user.id, organizationId: org.id, role: p.role },
    });
  }

  console.log(`Seeded org ${org.slug} with ${people.length} memberships.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
