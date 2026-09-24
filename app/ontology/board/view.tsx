"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { EmptyState, ProofStrip, Tag } from "@/components/primitives";
import type { TwinGraph, TwinOverview } from "@/lib/packs/manufacturing/service";
import type { AgencyBoard, FreightBoard } from "@/lib/packs/board";

import FlowBoard from "./flow";

const SiteMap = dynamic(() => import("@/app/ontology/twin/site-map"), {
  ssr: false,
  loading: () => <div className="ds-panel-2 h-[380px] animate-pulse rounded-[10px]" role="status" aria-label="Loading map" />,
});

const money = (v: number) => `$${v.toFixed(2)}`;
const moneyShort = (v: number) =>
  Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

function mergeGraphs(graphs: Array<TwinGraph | null>): TwinGraph {
  const nodes = new Map<string, TwinGraph["nodes"][number]>();
  const edges: TwinGraph["edges"] = [];
  for (const g of graphs) {
    if (!g) continue;
    for (const n of g.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
    edges.push(...g.edges);
  }
  return { nodes: [...nodes.values()], edges };
}

// Every row is a link: bars are navigation, not decoration.
function MarginBars({
  title,
  actionHref,
  actionLabel,
  items,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  items: Array<{ label: string; detail: string; href: string; value: number; pct: number | null }>;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <section aria-label={title} className="ds-panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold ds-text">{title}</h2>
        <Link href={actionHref} className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
          {actionLabel}
        </Link>
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((i) => (
          <li key={i.label}>
            <Link
              href={i.href}
              className="ds-state group flex items-center gap-3 rounded-md px-2 py-1.5"
              aria-label={`${i.label}, margin ${i.value < 0 ? "loss" : "profit"} ${money(i.value)}, ${i.detail}`}
            >
              <span className="w-40 shrink-0 truncate text-[13px] ds-text">{i.label}</span>
              <span className="relative h-5 min-w-0 flex-1 overflow-hidden rounded" style={{ background: "var(--panel-2)" }}>
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${Math.max(4, (Math.abs(i.value) / max) * 100)}%`,
                    background: i.value < 0 ? "var(--danger)" : "var(--success)",
                  }}
                />
              </span>
              <span
                className="w-20 shrink-0 text-right font-mono text-[13px] tabular-nums"
                style={{ color: i.value < 0 ? "var(--danger)" : "var(--success)" }}
              >
                {moneyShort(i.value)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const MIX_COLORS = ["var(--accent)", "var(--info)", "var(--warn)", "var(--success)", "var(--danger)"];

function CostMix({ title, entries }: { title: string; entries: Array<[string, number]> }) {
  const total = entries.reduce((a, [, v]) => a + v, 0);
  if (total <= 0 || entries.length === 0) return null;
  return (
    <section aria-label={title} className="ds-panel p-4">
      <h2 className="text-[15px] font-semibold ds-text">{title}</h2>
      <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full" role="img" aria-label={`${title}: ${entries.map(([k, v]) => `${k} ${moneyShort(v)}`).join(", ")}`}>
        {entries.map(([k, v], i) => (
          <span
            key={k}
            aria-hidden
            style={{ width: `${(v / total) * 100}%`, background: MIX_COLORS[i % MIX_COLORS.length] }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {entries.map(([k, v], i) => (
          <li key={k}>
            <Tag k={k} v={`${moneyShort(v)}`} tone={i === 0 ? "info" : "neutral"} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function BoardView({
  pack,
  overview,
  graph,
  freight,
  agency,
  pending,
  hasRuns,
}: {
  pack: "all" | "freight" | "manufacturing" | "agency";
  overview: TwinOverview | null;
  graph: TwinGraph | null;
  freight: FreightBoard | null;
  agency: AgencyBoard | null;
  pending: number;
  hasRuns: boolean;
}) {
  const showFreight = pack === "all" || pack === "freight";
  const showMfg = pack === "all" || pack === "manufacturing";
  const showAgency = pack === "all" || pack === "agency";
  const allGraph = mergeGraphs([graph, freight?.graph ?? null, agency?.graph ?? null]);
  const mapGraph = pack === "all" ? allGraph : showFreight && freight ? mergeGraphs([graph, freight.graph]) : (graph ?? allGraph);
  const hasAnything = overview !== null || freight !== null || agency !== null;

  if (!hasAnything) {
    return (
      <EmptyState
        title={hasRuns ? "Your data is on its way" : "Nothing on the board yet"}
        body={
          hasRuns
            ? "Your import is still processing or waiting for column mapping. Give it a minute, then reload."
            : "Connect a file or sync a connector and every truck, lot, project, and route lands here as something you can click."
        }
        actionHref={hasRuns ? "/upload" : "/upload?next=/ontology/board"}
        actionLabel={hasRuns ? "Check imports" : "Connect your company data"}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ProofStrip
        items={[
          ...(showFreight && freight
            ? [
                { label: "Freight margin", value: money(freight.totals.margin), detail: `${freight.totals.loads} loads · week of ${freight.weekStart}`, href: "/answers" },
                { label: "Freight revenue", value: money(freight.totals.revenue), href: "/answers" },
              ]
            : []),
          ...(showMfg && overview
            ? [
                { label: "Lots below reorder", value: String(overview.atRiskLots), href: "/ontology/twin" },
                { label: "Delayed shipments", value: String(overview.delayedShipments), href: "/ontology/twin" },
              ]
            : []),
          ...(showAgency && agency
            ? [
                { label: "Studio margin", value: money(agency.totals.margin), detail: `${agency.totals.revisions} revisions · week of ${agency.weekStart}`, href: "/answers/projects" },
                { label: "Studio revenue", value: money(agency.totals.revenue), href: "/answers/projects" },
              ]
            : []),
          { label: "Pending approvals", value: String(pending), href: "/ontology/inbox" },
        ]}
      />

      {allGraph.nodes.length > 0 && (
        <section aria-label="Workflow" className="ds-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold ds-text">
              Workflow <span className="font-normal ds-text-2">· {allGraph.nodes.length} steps, {allGraph.edges.length} flows</span>
            </h2>
            <Link href="/ontology/explore" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              Explore all
            </Link>
          </div>
          <div className="mt-3">
            <FlowBoard graph={allGraph} />
          </div>
        </section>
      )}

      {mapGraph.nodes.some((n) => n.geopoint) && (
        <section aria-label="Map" className="ds-panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold ds-text">Map</h2>
            <Link href="/ontology/twin" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              Open twin
            </Link>
          </div>
          <div className="mt-3">
            <SiteMap graph={mapGraph} />
          </div>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {showFreight &&
          (freight ? (
            <>
              <MarginBars
                title="Bleeding lanes"
                actionHref="/answers"
                actionLabel="All lanes"
                items={freight.worst.map((l) => ({
                  label: l.lane,
                  detail: `${l.loads} loads`,
                  href: `/answers/lane?lane=${encodeURIComponent(l.lane)}&week=${freight.weekStart}`,
                  value: l.margin,
                  pct: l.marginPct,
                }))}
              />
              {pack !== "all" && <CostMix title="Where freight money goes" entries={Object.entries(freight.costByKind)} />}
            </>
          ) : (
            <EmptyState
              title="No freight on the board"
              body="Upload a TMS export and lanes, trucks, and routes appear here."
              actionHref="/upload?next=/ontology/board"
              actionLabel="Upload"
            />
          ))}
        {showAgency &&
          (agency ? (
            <>
              <MarginBars
                title="Bleeding projects"
                actionHref="/answers/projects"
                actionLabel="All projects"
                items={agency.worst.map((p) => ({
                  label: `${p.project} · ${p.client}`,
                  detail: `${p.revisions} revisions`,
                  href: `/answers/project?project=${encodeURIComponent(p.project)}&week=${agency.weekStart}`,
                  value: p.margin,
                  pct: p.marginPct,
                }))}
              />
              {pack !== "all" && <CostMix title="Where studio money goes" entries={Object.entries(agency.costByKind)} />}
            </>
          ) : (
            <EmptyState
              title="No studio work on the board"
              body="Import time and invoice exports and projects land here."
              actionHref="/upload?next=/ontology/board"
              actionLabel="Upload"
            />
          ))}
        {showMfg &&
          (overview ? (
            <>
              <section aria-label="At-risk lots" className="ds-panel p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold ds-text">At-risk lots</h2>
                  <Link href="/ontology/twin" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                    Open twin
                  </Link>
                </div>
                <ul className="mt-3 space-y-1">
                  {overview.coverage
                    .filter((c) => c.belowReorderPoint)
                    .slice(0, 5)
                    .map((c) => (
                      <li key={c.id}>
                        <Link
                          href="/ontology/twin"
                          className="ds-state flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                          aria-label={`${c.key}, coverage ${c.coverageDays ?? "unknown"} days, below reorder point`}
                        >
                          <span className="truncate text-[13px] ds-text">{c.key}</span>
                          <Tag k="cover" v={c.coverageDays === null ? "?" : `${c.coverageDays}d`} tone="bad" />
                        </Link>
                      </li>
                    ))}
                  {overview.coverage.filter((c) => c.belowReorderPoint).length === 0 && (
                    <li className="px-2 py-1.5 text-[13px] ds-text-2">Everything stocked. Enjoy it while it lasts.</li>
                  )}
                </ul>
              </section>
              <section aria-label="Delayed shipments" className="ds-panel p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold ds-text">Delayed shipments</h2>
                  <Link href="/ontology/twin" className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                    Open twin
                  </Link>
                </div>
                <ul className="mt-3 space-y-1">
                  {overview.shipments
                    .filter((s) => s.status === "delayed")
                    .slice(0, 5)
                    .map((s) => (
                      <li key={s.id}>
                        <Link
                          href="/ontology/twin"
                          className="ds-state flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                          aria-label={`${s.key}, delayed${s.eta ? `, ETA ${s.eta}` : ""}`}
                        >
                          <span className="truncate text-[13px] ds-text">{s.key}</span>
                          <Tag k="eta" v={s.eta ?? "?"} tone="bad" />
                        </Link>
                      </li>
                    ))}
                  {overview.shipments.filter((s) => s.status === "delayed").length === 0 && (
                    <li className="px-2 py-1.5 text-[13px] ds-text-2">Nothing delayed right now.</li>
                  )}
                </ul>
              </section>
            </>
          ) : (
            <EmptyState
              title="No factories on the board"
              body="Seed the manufacturing pack and plants, warehouses, and shipments appear here."
              actionHref="/ontology/twin"
              actionLabel="Open twin"
            />
          ))}
      </div>
    </div>
  );
}
