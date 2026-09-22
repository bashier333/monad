import Link from "next/link";
import { getWeeklyAnswer } from "@/lib/packs/freight/service";
import { getAgencyAnswer } from "@/lib/packs/agency/service";
import { db } from "@/lib/core/db";
import { logAccess } from "@/lib/core/access";
import { DataTable } from "@/components/primitives";

export const metadata = { robots: "noindex, nofollow" };

// Public share view: branded header, first rows open, the rest blurred
// behind signup (progressive disclosure), dual CTA to demo + pricing.
const VISIBLE_ROWS = 3;

function GrowthHeader({ org, weekStart }: { org: string; weekStart: string }) {
  return (
    <header className="space-y-2 rounded border p-4 ds-panel" style={{ borderColor: "var(--hairline)" }}>
      <p className="text-sm ds-text-2">
        Shared by {org} · week of {weekStart} · read-only
      </p>
      <p className="text-sm ds-text">
        <span className="font-medium">Monad</span> turns weekly exports into margin answers like this one.{" "}
        <Link href="/demo?utm_source=share" className="underline">
          What is this?
        </Link>
      </p>
      <p className="flex flex-wrap gap-2">
        <Link
          href="/demo?utm_source=share"
          className="ds-control inline-block rounded px-4 py-2 text-sm font-medium"
          style={{ background: "var(--accent)", color: "#ffffff" }}
        >
          Get answers like this
        </Link>
        <Link
          href="/pricing?utm_source=share"
          className="ds-control inline-block rounded border px-4 py-2 text-sm ds-text"
          style={{ borderColor: "var(--hairline)" }}
        >
          See pricing
        </Link>
      </p>
    </header>
  );
}

function BlurredRowsNote() {
  return (
    <div className="relative">
      <p className="rounded border p-4 text-center text-sm ds-panel" style={{ borderColor: "var(--hairline)" }}>
        <span className="font-medium ds-text">The full table is behind a free account.</span>{" "}
        <Link href="/demo?utm_source=share" className="underline">
          See the demo
        </Link>{" "}
        or <Link href="/pricing?utm_source=share" className="underline">see pricing</Link>.
      </p>
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await db.answerShare.findUnique({
    where: { token },
    include: { organization: true },
  });
  if (!share || share.revoked || share.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p className="ds-text">This link expired or is invalid. Ask the sender for a fresh one.</p>
      </main>
    );
  }
  await logAccess(share.organizationId, "anonymous", "share:view", share.id);
  const views = await db.accessLog.count({
    where: { organizationId: share.organizationId, action: "share:view", target: share.id },
  });

  if (share.pack === "agency") {
    const answer = await getAgencyAnswer(share.organizationId, share.organization.weekStartsOn, share.weekStart);
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <GrowthHeader org={share.organization.name} weekStart={answer.meta.weekStart} />
        <h1 className="text-xl font-bold ds-text">Project margins</h1>
        <DataTable
          caption={`Shared project margins, week of ${answer.meta.weekStart}`}
          columns={[
            { label: "Project" },
            { label: "Rounds", numeric: true },
            { label: "Revenue", numeric: true },
            { label: "Cost", numeric: true },
            { label: "Margin", numeric: true },
          ]}
          rows={answer.projects.slice(0, VISIBLE_ROWS).map((p) => [
            <span key={`p-${p.project}`}>{p.project}</span>,
            <span key={`r-${p.project}`}>{p.revisions}</span>,
            <span key={`rev-${p.project}`}>${p.revenue.toFixed(2)}</span>,
            <span key={`c-${p.project}`}>${p.cost.toFixed(2)}</span>,
            <span
              key={`m-${p.project}`}
              className="font-medium"
              style={{ color: p.margin < 0 ? "var(--danger)" : "var(--success)" }}
              aria-label={`margin ${p.margin < 0 ? "loss" : "profit"} $${p.margin.toFixed(2)}`}
            >
              <span aria-hidden>{p.margin < 0 ? "▼ " : "▲ "}</span>${p.margin.toFixed(2)}
            </span>,
          ])}
        />
        {answer.projects.length > VISIBLE_ROWS && <BlurredRowsNote />}
        <p className="text-sm ds-text-2">Viewed {views} time{views === 1 ? "" : "s"}.</p>
      </main>
    );
  }

  const answer = await getWeeklyAnswer(share.organizationId, share.organization.weekStartsOn, share.weekStart);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <GrowthHeader org={share.organization.name} weekStart={answer.meta.weekStart} />
      <h1 className="text-xl font-bold ds-text">Lane margins</h1>
      <DataTable
        caption={`Shared lane margins, week of ${answer.meta.weekStart}`}
        columns={[
          { label: "Lane" },
          { label: "Loads", numeric: true },
          { label: "Revenue", numeric: true },
          { label: "Cost", numeric: true },
          { label: "Margin", numeric: true },
        ]}
        rows={answer.lanes.slice(0, VISIBLE_ROWS).map((l) => [
          <span key={`l-${l.lane}`}>{l.lane}</span>,
          <span key={`n-${l.lane}`}>{l.loads}</span>,
          <span key={`r-${l.lane}`}>${l.revenue.toFixed(2)}</span>,
          <span key={`c-${l.lane}`}>${l.cost.toFixed(2)}</span>,
          <span
            key={`m-${l.lane}`}
            className="font-medium"
            style={{ color: l.margin < 0 ? "var(--danger)" : "var(--success)" }}
            aria-label={`margin ${l.margin < 0 ? "loss" : "profit"} $${l.margin.toFixed(2)}`}
          >
            <span aria-hidden>{l.margin < 0 ? "▼ " : "▲ "}</span>${l.margin.toFixed(2)}
          </span>,
        ])}
      />
      {answer.lanes.length > VISIBLE_ROWS && <BlurredRowsNote />}
      <p className="text-sm ds-text-2">Viewed {views} time{views === 1 ? "" : "s"}.</p>
    </main>
  );
}
