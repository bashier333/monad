import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";

export default async function OntologyTypePage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Link href="/signin" className="underline">
          Sign in
        </Link>
      </main>
    );
  }
  const active = await getActiveOrg(session.user.id);
  if (!active) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>No organization yet.</p>
      </main>
    );
  }
  const { key } = await params;
  const type = await db.ontoType
    .findUnique({
      where: { organizationId_key: { organizationId: active.organization.id, key } },
      include: { properties: { orderBy: { key: "asc" } } },
    })
    .catch(() => null);
  if (!type || type.deletedAt) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          Type not found. <Link href="/ontology" className="underline">Back to Studio</Link>
        </p>
      </main>
    );
  }
  const [links, versions, count] = await Promise.all([
    db.ontoLink
      .findMany({
        where: { organizationId: active.organization.id, OR: [{ fromTypeKey: key }, { toTypeKey: key }] },
        orderBy: { key: "asc" },
      })
      .catch(() => []),
    db.ontoTypeVersion
      .findMany({
        where: { organizationId: active.organization.id, typeId: type.id },
        orderBy: { version: "desc" },
        take: 20,
      })
      .catch(() => []),
    db.ontoObject
      .count({ where: { organizationId: active.organization.id, typeKey: key, deletedAt: null } })
      .catch(() => 0),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline">
          Studio
        </Link>{" "}
        / {type.key}
      </p>
      <div>
        <h1 className="text-xl font-bold ds-text">
          {type.label} <span className="text-sm font-normal ds-text-2">v{type.version} · {count} objects</span>
        </h1>
        {type.description && <p className="mt-1 text-sm ds-text-2">{type.description}</p>}
      </div>
      <section>
        <h2 className="font-medium ds-text">Properties ({type.properties.length})</h2>
        <table className="ds-table mt-2 w-full text-sm">
          <thead>
            <tr className="text-left">
              <th scope="col" className="px-2 font-medium ds-text-2">Key</th>
              <th scope="col" className="px-2 font-medium ds-text-2">Kind</th>
              <th scope="col" className="px-2 font-medium ds-text-2">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--hairline)" }}>
            {type.properties.map((p) => (
              <tr key={p.id}>
                <td className="px-2 py-1 font-medium ds-text">{p.key}</td>
                <td className="px-2 font-mono text-xs ds-text-2">{p.kind}</td>
                <td className="px-2 ds-text-2">
                  {[p.required && "required", p.unique && "unique", p.indexed && "indexed", p.immutable && "immutable"]
                    .filter(Boolean)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2 className="font-medium ds-text">Links ({links.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {links.map((l) => (
            <li key={l.id} className="p-3 text-sm">
              <span className="ds-text">{l.fromTypeKey} → {l.toTypeKey}</span>{" "}
              <span className="ds-text-2">({l.key}, {l.cardinality})</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium ds-text">Versions ({versions.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {versions.map((v) => (
            <li key={v.id} className="p-3 text-sm">
              <span className="ds-text">v{v.version}</span> <span className="ds-text-2">{v.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
