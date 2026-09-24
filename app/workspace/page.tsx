import Link from "next/link";
import { Bot, FileText, Upload, UserPlus } from "lucide-react";
import { auth } from "@/lib/core/auth";
import { db } from "@/lib/core/db";
import { getActiveOrg } from "@/lib/core/org";
import { verifyEventChain } from "@/lib/core/ontology/facts";
import { twinOverview } from "@/lib/packs/manufacturing/service";
import { ProofStrip } from "@/components/primitives";
import Tour, { ReplayTourButton } from "@/components/Tour";

const TOUR_STEPS = [
  {
    title: "Welcome to your workspace",
    body: "This one screen watches your whole operation. Four numbers tell you its health, nine tools do the work, and everything below proves it. Nothing here is a trick. Every number comes from your data.",
  },
  {
    target: '[data-tour="search"]',
    title: "Find anything",
    body: "Type a lot number, shipment, plant, or customer. Search looks across every kind of thing at once and tells you why each result matched.",
  },
  {
    target: '[data-tour="proof"]',
    title: "Health at a glance",
    body: "Lots below reorder, delayed shipments, waiting approvals, and whether the audit trail verifies. If a number surprises you, click through. Every figure links to its evidence.",
  },
  {
    title: "Everything lives in the sidebar",
    body: "Twin shows decisions, Automations asks the AI (which never acts without your confirmation), Actions change things with approval, and Audit proves what happened. The sidebar is always one click away. Start with Twin.",
  },
  {
    title: "One keystroke away",
    body: "Press Ctrl+K (or Cmd+K on Mac) anywhere to jump to any page or object. Press / to focus a search box, Esc to close dialogs. You now know enough to run the place.",
  },
];

async function gate() {
  const session = await auth();
  if (!session?.user?.id) return { gate: "signin" as const };
  let active = await getActiveOrg(session.user.id);
  if (!active) {
    // Belt and suspenders: the signIn event provisions, but sessions created
    // before that (or a failed event) still need a workspace on first visit.
    try {
      const { ensurePersonalOrg } = await import("@/lib/core/provision");
      await ensurePersonalOrg(session.user.id, session.user.email ?? null);
      active = await getActiveOrg(session.user.id);
    } catch {
      return { gate: "setup-failed" as const };
    }
  }
  if (!active) return { gate: "noorg" as const };
  return { gate: "ok" as const, orgId: active.organization.id };
}


export default async function WorkspacePage() {
  const g = await gate();
  if (g.gate !== "ok") {
    if (g.gate === "signin") {
      return (
        <main className="mx-auto max-w-2xl p-8">
          <p className="ds-text">
            <Link href="/signin" className="underline">
              Sign in
            </Link>{" "}
            to open the workspace.
          </p>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8">
        <h1 className="text-xl font-semibold tracking-tight ds-text">Setting up your workspace…</h1>
        <p className="text-sm ds-text-2">
          Your sign-in worked, but your personal workspace is not ready yet. Reload this page. If it still
          shows, contact support and mention “workspace provisioning”.
        </p>
        <p className="text-sm ds-text-2">
          <Link href="/support" className="underline">
            Contact support
          </Link>
        </p>
      </main>
    );
  }
  // Every source degrades independently: with the database unreachable the
  // page still renders sign-in state, navigation, and empty states.
  const [overview, pending, chain, feeds] = await Promise.all([
    twinOverview(g.orgId).catch(() => null),
    db.ontoApproval.count({ where: { organizationId: g.orgId, status: "pending" } }).catch(() => 0),
    verifyEventChain(g.orgId, 5000).catch(() => ({ ok: false, checked: 0, brokenAt: null as string | null })),
    db.importRun
      .findMany({
        where: { organizationId: g.orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { file: { select: { filename: true } } },
      })
      .catch(() => []),
  ]);

  const isFirstRun = feeds.length === 0;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {isFirstRun && <Tour steps={TOUR_STEPS} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight ds-text">Workspace</h1>
          <p className="mt-1 text-sm ds-text-2">
            Health first, then the tools. New here? Take the tour.
          </p>
        </div>
        <ReplayTourButton />
      </div>

      <form action="/ontology/explore" method="get" className="flex gap-2" data-tour="search">
        <label htmlFor="workspace-q" className="sr-only">
          Search objects
        </label>
        <input
          id="workspace-q"
          name="q"
          placeholder="Search lots, shipments, plants…"
          autoComplete="off"
          className="w-full rounded-md border px-3 py-2 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
        />
        <button type="submit" className="whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--accent)" }}>
          Search
        </button>
      </form>

      <section aria-label="Quick actions">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <li>
            <Link href="/upload" className="ds-state flex items-center gap-2.5 rounded-[10px] border p-3" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
              <Upload size={16} aria-hidden style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium ds-text">Upload a feed</span>
            </Link>
          </li>
          <li>
            <Link href="/ontology/automations" className="ds-state flex items-center gap-2.5 rounded-[10px] border p-3" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
              <Bot size={16} aria-hidden style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium ds-text">Ask the model</span>
            </Link>
          </li>
          <li>
            <Link href="/briefs" className="ds-state flex items-center gap-2.5 rounded-[10px] border p-3" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
              <FileText size={16} aria-hidden style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium ds-text">Read the brief</span>
            </Link>
          </li>
          <li>
            <Link href="/settings" className="ds-state flex items-center gap-2.5 rounded-[10px] border p-3" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
              <UserPlus size={16} aria-hidden style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium ds-text">Invite the team</span>
            </Link>
          </li>
        </ul>
      </section>

      <section aria-label="Proof" data-tour="proof" className="ds-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold ds-text">Operation health</h2>
          <Link href="/ontology/twin" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
            Open twin
          </Link>
        </div>
        <div className="mt-3">
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
        </div>
        {overview === null && (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>
            No manufacturing model yet. Seed the pack from the Twin page to populate these cards.
          </p>
        )}
      </section>


      <section aria-label="Latest imports" className="ds-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold ds-text">Latest imports</h2>
          {feeds.length > 0 && (
            <Link href="/upload" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              Connect more
            </Link>
          )}
        </div>
        {feeds.length === 0 ? (
          <div className="mt-2 rounded border border-dashed p-4" style={{ borderColor: "var(--hairline)" }}>
            <p className="text-sm ds-text-2">No data connected yet. Your board fills in as soon as your first file lands.</p>
            <p className="mt-3">
              <Link
                href="/upload?next=/workspace"
                className="inline-block rounded-md px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                Connect your company data
              </Link>
            </p>
          </div>
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

    </main>
  );
}
