import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import ModelBoardLoader from "@/app/ontology/model-board-loader";
import TypeBuilder from "@/components/TypeBuilder";

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id, isOwner: active.membership.role === "OWNER" };
}

export default async function OntologyPage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p>
          <Link href="/signin" className="underline">
            Sign in
          </Link>{" "}
          to open Ontology Studio.
        </p>
      </main>
    );
  }
  // Every source degrades independently: a query failure renders empty
  // sections, never a dead page.
  const [types, links, actions, counts] = await Promise.all([
    db.ontoType.findMany({ where: { organizationId: g.orgId, deletedAt: null }, include: { properties: true }, orderBy: { key: "asc" } }).catch(() => []),
    db.ontoLink.findMany({ where: { organizationId: g.orgId }, orderBy: { key: "asc" } }).catch(() => []),
    db.ontoAction.findMany({ where: { organizationId: g.orgId, enabled: true }, orderBy: { key: "asc" } }).catch(() => []),
    db.ontoObject.groupBy({ by: ["typeKey"], where: { organizationId: g.orgId, deletedAt: null }, _count: { _all: true } }).catch(() => []),
  ]);
  const objectCount = new Map(counts.map((c) => [c.typeKey, c._count._all]));
  const boardTypes = types.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description ?? "",
    objectCount: objectCount.get(t.key) ?? 0,
    properties: t.properties.map((p) => ({
      key: p.key,
      kind: p.kind,
      flags: [p.required && "required", p.unique && "unique", p.indexed && "indexed", p.immutable && "immutable"]
        .filter(Boolean)
        .join(", "),
    })),
    actions: actions
      .filter((a) => a.targetTypeKey === t.key)
      .map((a) => ({ key: a.key, label: a.label, approvalPolicy: a.approvalPolicy })),
  }));
  const boardLinks = links.map((l) => ({ key: l.key, from: l.fromTypeKey, to: l.toTypeKey, cardinality: l.cardinality }));
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ontology Studio</h1>
        <p className="flex gap-3 text-sm">
          <Link href="/ontology/explore" className="underline">Explore</Link>
          <Link href="/ontology/actions" className="underline">Actions</Link>
          <Link href="/ontology/twin" className="underline">Twin</Link>
          <Link href="/ontology/automations" className="underline">Automations</Link>
          <Link href="/ontology/scenarios" className="underline">Scenarios</Link>
          <Link href="/ontology/inbox" className="underline">Inbox</Link>
          <Link href="/ontology/audit" className="underline">Audit</Link>
          <Link href="/ontology/ops" className="underline">Ops</Link>
        </p>
      </div>
      {g.isOwner && <TypeBuilder />}
      <section aria-label="Guides" className="ds-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold ds-text">Guides</h2>
          <Link href="/help/ontology" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
            Full guide
          </Link>
        </div>
        <ul className="mt-2 grid gap-2 md:grid-cols-3">
          <li>
            <Link href="/ontology/docs/types" className="ds-state block rounded-md border p-3" style={{ borderColor: "var(--hairline)" }}>
              <span className="text-sm font-medium ds-text">Types</span>
              <span className="mt-0.5 block text-[13px] ds-text-2">The nouns: what you track and their properties.</span>
            </Link>
          </li>
          <li>
            <Link href="/ontology/docs/links" className="ds-state block rounded-md border p-3" style={{ borderColor: "var(--hairline)" }}>
              <span className="text-sm font-medium ds-text">Links</span>
              <span className="mt-0.5 block text-[13px] ds-text-2">How things connect and what that unlocks.</span>
            </Link>
          </li>
          <li>
            <Link href="/ontology/docs/actions" className="ds-state block rounded-md border p-3" style={{ borderColor: "var(--hairline)" }}>
              <span className="text-sm font-medium ds-text">Actions</span>
              <span className="mt-0.5 block text-[13px] ds-text-2">The only way to change things, safely.</span>
            </Link>
          </li>
        </ul>
      </section>
      <section aria-label="Model map">
        <h2 className="font-medium ds-text">How it all fits together</h2>
        <p className="mt-1 text-sm ds-text-2">
          Every business has nouns (the things: plants, shipments) and verbs (the doings: transfer, approve).
          This is yours, as the computer sees it.
        </p>
        <div className="mt-2">
          <ModelBoardLoader types={boardTypes} links={boardLinks} />
        </div>
      </section>
      {types.length === 0 && (
        <p className="rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
          No live types yet. Seed freight and agency packs from the API, or define your first type.
        </p>
      )}
      <section>
        <h2 className="font-medium ds-text">Types ({types.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {types.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                <Link href={`/ontology/${t.key}`} className="font-medium underline ds-text">
                  {t.label}
                </Link>{" "}
                <span className="ds-text-2">
                  {t.key} · v{t.version} · {t.properties.length} properties · {objectCount.get(t.key) ?? 0} objects · {t.status}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium ds-text">Links ({links.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {links.map((l) => (
            <li key={l.id} className="p-3 text-sm">
              <span className="font-medium ds-text">{l.key}</span>{" "}
              <span className="ds-text-2">
                {l.fromTypeKey} → {l.toTypeKey} · {l.cardinality}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-medium ds-text">Export blueprint</h2>
        <p className="mt-1 text-sm ds-text-2">
          Take your blueprint, not just your bricks. The JSON blueprint is the canonical round-trippable model;
          LinkML and SHACL are lossy views (no actions, approvals, policies, or latitude).
        </p>
        <p className="mt-2 flex gap-3 text-sm ds-text">
          <a href="/api/ontology/packs/export?format=json" className="underline" download>
            JSON blueprint
          </a>
          <a href="/api/ontology/packs/export?format=linkml" className="underline" download>
            LinkML view
          </a>
          <a href="/api/ontology/packs/export?format=shacl" className="underline" download>
            SHACL view
          </a>
        </p>
      </section>
      <section>
        <h2 className="font-medium ds-text">Actions ({actions.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {actions.map((a) => (
            <li key={a.id} className="p-3 text-sm">
              <span className="font-medium ds-text">{a.label}</span>{" "}
              <span className="ds-text-2">
                {a.key} · {a.targetTypeKey} · {a.approvalPolicy}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
