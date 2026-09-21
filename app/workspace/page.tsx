import Link from "next/link";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { verifyEventChain } from "@/lib/core/ontology/facts";
import { twinOverview } from "@/lib/packs/manufacturing/service";
import { ProofStrip } from "@/components/primitives";
import Tour, { ReplayTourButton } from "@/components/Tour";
import UpdateButton from "@/components/UpdateButton";
import { pqlForOrg } from "@/lib/core/usage-snapshot";

const TOUR_STEPS = [
  {
    title: "Welcome to your workspace",
    body: "This one screen watches your whole operation. Four numbers tell you its health, nine tools do the work, and everything below proves it. Nothing here is a demo trick — every number comes from your data.",
  },
  {
    target: '[data-tour="search"]',
    title: "Find anything",
    body: "Type a lot number, shipment, plant, or customer. Search looks across every kind of thing at once and tells you why each result matched.",
  },
  {
    target: '[data-tour="proof"]',
    title: "Health at a glance",
    body: "Lots below reorder, delayed shipments, waiting approvals, and whether the audit trail verifies. If a number surprises you, click through — every figure links to its evidence.",
  },
  {
    target: '[data-tour="modules"]',
    title: "Nine tools, one model",
    body: "Twin shows decisions, Automations asks the AI (which never acts without your confirmation), Actions change things with approval, and Audit proves what happened. Start with Twin.",
  },
  {
    title: "One keystroke away",
    body: "Press Ctrl+K (or Cmd+K on Mac) anywhere to jump to any page or object. Press / to focus a search box, Esc to close dialogs. You now know enough to run the place.",
  },
];

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  const active = await getActiveOrg(session.user.id);
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}

const MODULES = [
  { href: "/ontology/twin", label: "Twin", desc: "Coverage, risks, and network" },
  { href: "/ontology/automations", label: "Automations", desc: "Ask the model, confirm actions" },
  { href: "/ontology/explore", label: "Explore", desc: "Search objects and traverse links" },
  { href: "/ontology/actions", label: "Actions", desc: "Run governed actions with approval" },
  { href: "/ontology/scenarios", label: "Scenarios", desc: "Stage what-if branches and merge" },
  { href: "/ontology/inbox", label: "Inbox", desc: "Approve actions and corrections" },
  { href: "/ontology/audit", label: "Audit", desc: "Hash-chained event trail" },
  { href: "/ontology/ops", label: "Ops", desc: "Policies, playbooks, and alerts" },
  { href: "/ontology", label: "Schema", desc: "Types, links, and versions" },
];

export default async function WorkspacePage() {
  const g = await gate();
  if (g.gate !== "ok") {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="ds-text">
          <Link href="/api/auth/signin" className="underline">
            Sign in
          </Link>{" "}
          to open the workspace.
        </p>
      </main>
    );
  }
  // Every source degrades independently: with the database unreachable the
  // page still renders sign-in state, navigation, and empty states.
  const [overview, pending, runs, chain, feeds, members, objects, pql] = await Promise.all([
    twinOverview(g.orgId).catch(() => null),
    db.ontoApproval.count({ where: { organizationId: g.orgId, status: "pending" } }).catch(() => 0),
    db.ontoActionRun
      .findMany({
        where: { organizationId: g.orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
      .catch(() => []),
    verifyEventChain(g.orgId, 5000).catch(() => ({ ok: false, checked: 0, brokenAt: null as string | null })),
    db.importRun
      .findMany({
        where: { organizationId: g.orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { file: { select: { filename: true } } },
      })
      .catch(() => []),
    db.membership.count({ where: { organizationId: g.orgId } }).catch(() => 1),
    db.ontoObject.count({ where: { organizationId: g.orgId, deletedAt: null } }).catch(() => 0),
    pqlForOrg(g.orgId).catch(() => null),
  ]);

  // Sample honesty: objects exist but no import run ever completed, so every
  // number on this page comes from seeded fixtures — labeled as such, never
  // presented as production truth.
  const sample = overview !== null && feeds.filter((f) => f.status === "COMPLETED").length === 0;
  const checklist = [
    { label: "Explore the sample decision", done: objects > 0, href: "/ontology/twin" },
    { label: "Import a real feed", done: feeds.some((f) => f.status === "COMPLETED"), href: "/upload" },
    { label: "Confirm a first action", done: runs.length > 0, href: "/ontology/actions" },
    { label: "Invite a reviewer", done: members > 1, href: "/settings" },
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <Tour steps={TOUR_STEPS} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl font-bold ds-text">Workspace</h1>
          <p className="mt-1 text-sm ds-text-2">
            One screen for your whole operation: health first, then the tools. New here? Take the tour.
          </p>
        </div>
        <ReplayTourButton />
      </div>

      {pql && (
        <p className="rounded p-3 text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
          <span className="font-medium ds-text">Adoption {pql.score}/100</span>
          <span className="ds-text-2"> — {pql.pql ? "qualified: this workspace is driving decisions." : "not yet qualified."} {pql.reasons.join(" · ")}</span>
        </p>
      )}

      {sample && (
        <p role="status" className="rounded p-3 text-sm ds-panel" style={{ borderColor: "var(--warn)" }}>
          <span className="font-medium" style={{ color: "var(--warn)" }}>SAMPLE DATA</span>
          <span className="ds-text-2"> — every number below comes from seeded fixtures, not your operation. Import a real feed to replace it.</span>
        </p>
      )}

      <form action="/ontology/explore" method="get" className="flex gap-2" data-tour="search">
        <label htmlFor="workspace-q" className="sr-only">
          Search objects
        </label>
        <input
          id="workspace-q"
          name="q"
          placeholder="Search lots, shipments, plants…"
          autoComplete="off"
          className="w-full rounded border px-3 py-2 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
        <button type="submit" className="whitespace-nowrap rounded px-4 py-2 text-sm text-[#141413]" style={{ background: "var(--accent)" }}>
          Search
        </button>
      </form>

      <section aria-label="Proof" data-tour="proof">
        <ProofStrip
          items={[
            { label: "Lots below reorder", value: overview ? String(overview.atRiskLots) : "—", href: "/ontology/twin" },
            { label: "Delayed shipments", value: overview ? String(overview.delayedShipments) : "—", href: "/ontology/twin" },
            { label: "Pending approvals", value: String(pending), href: "/ontology/inbox" },
            {
              label: "Audit chain",
              value: chain.ok ? "OK" : "Check",
              detail: `${chain.checked} events verified`,
              href: "/ontology/audit",
            },
          ]}
        />
        {overview === null && (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
            No manufacturing model yet. Seed the pack from the Twin page to populate these cards.
          </p>
        )}
      </section>

      <section aria-label="Activation">
        <h2 className="font-medium ds-text">Getting started</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="ds-text">
                <span aria-hidden>{c.done ? "✓ " : "○ "}</span>
                {c.label}
                <span className="sr-only">{c.done ? " (done)" : " (not done)"}</span>
              </span>
              {!c.done && (
                <Link href={c.href} className="underline ds-text-2">
                  Do it
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Pipeline">
        <h2 className="font-medium ds-text">Feeds in → model → consumers</h2>
        {feeds.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
            No feeds imported yet. The twin reads versioned objects, never raw files — import a feed to start the bridge.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel text-sm" style={{ borderColor: "var(--hairline)" }}>
            {feeds.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <Link href={`/imports/${f.id}`} className="font-mono text-xs underline ds-text">
                  {f.file.filename}
                </Link>
                <span className="ds-text-2">
                  {f.status} · in {f.okRows}/{f.totalRows} · {f.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Modules" data-tour="modules">
        <h2 className="font-medium ds-text">Modules</h2>
        <ul className="mt-2 grid gap-2 md:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className="ds-state block h-full rounded ds-panel p-3">
                <span className="font-medium ds-text">{m.label}</span>
                <span className="mt-1 block text-sm ds-text-2">{m.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
        <UpdateButton />
        <Link href="/help/ontology" className="text-xs underline ds-text-2">
          New here? Read the guide
        </Link>
      </footer>

      <section aria-label="Recent activity">
        <h2 className="font-medium ds-text">Recent actions</h2>
        {runs.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
            Nothing executed yet. Propose an action from Automations or run one from Actions.
          </p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {runs.map((r) => (
              <li key={r.id} className="p-3 text-sm">
                <Link href="/ontology/actions" className="font-medium underline ds-text">
                  {r.actionKey}
                </Link>{" "}
                <span className="ds-text-2">
                  {r.status} - {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
