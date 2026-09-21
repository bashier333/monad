"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { TwinGraph, TwinOverview } from "@/lib/packs/manufacturing/service";

const CoverageChart = dynamic(
  () => import("@/app/ontology/twin/charts").then((m) => m.CoverageChart),
  { loading: () => <div className="h-[280px] rounded ds-panel" role="status" aria-label="Loading coverage chart" /> }
);

const ShipmentTimeline = dynamic(
  () => import("@/app/ontology/twin/charts").then((m) => m.ShipmentTimeline),
  { loading: () => <div className="h-[280px] rounded ds-panel" role="status" aria-label="Loading shipment timeline" /> }
);

const NetworkGraph = dynamic(() => import("@/app/ontology/twin/network-graph"), {
  ssr: false,
  loading: () => <div className="h-[440px] rounded ds-panel" aria-label="Loading network graph" />,
});

const SiteMap = dynamic(() => import("@/app/ontology/twin/site-map"), {
  ssr: false,
  loading: () => <div className="h-[440px] rounded ds-panel" aria-label="Loading site map" />,
});

// Decision queue first: fulfillment risks → coverage shortfalls → reorder
// suggestions. Charts prove, graph and map validate — never the reverse.
// This twin models meaning (decisions, risks, coverage), not machines.
export default function TwinBoard({ overview, graph }: { overview: TwinOverview; graph: TwinGraph }) {
  const router = useRouter();
  const [region, setRegion] = useState("");
  const [sku, setSku] = useState("");
  const [onlyRisk, setOnlyRisk] = useState(false);

  const whRegion = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of graph.nodes) {
      if (n.type === "warehouse" && n.region) m.set(n.key, n.region);
    }
    return m;
  }, [graph]);

  const regions = useMemo(() => [...new Set(graph.nodes.map((n) => n.region).filter((r): r is string => Boolean(r)))].sort(), [graph]);
  const skus = useMemo(() => [...new Set(overview.coverage.map((c) => c.sku).filter((s): s is string => Boolean(s)))].sort(), [overview]);

  const lots = overview.coverage.filter((l) => {
    if (region && whRegion.get(l.warehouse ?? "") !== region) return false;
    if (sku && l.sku !== sku) return false;
    if (onlyRisk && !l.belowReorderPoint) return false;
    return true;
  });

  // Risks carry no region of their own, so the region filter does not apply
  // to them — filtering them by guesswork would be fake precision.
  const risks = overview.risks;

  const c = overview.counts;

  return (
    <div className="space-y-6">
      <p className="text-sm ds-text-2">
        Twin of meaning, not of machines: what each site holds, what is moving, who is exposed, and which
        reorder covers it — with reasons, not just readings.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm ds-text">
          Region
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="ml-2 rounded border px-2 py-1.5 ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}>
            <option value="">all</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm ds-text">
          Product
          <select value={sku} onChange={(e) => setSku(e.target.value)} className="ml-2 rounded border px-2 py-1.5 ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}>
            <option value="">all</option>
            {skus.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm ds-text">
          <input type="checkbox" checked={onlyRisk} onChange={(e) => setOnlyRisk(e.target.checked)} className="mr-1" />
          below reorder only
        </label>
        <button onClick={() => router.refresh()} className="ds-state ml-auto rounded border px-3 py-1.5 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
          Refresh
        </button>
      </div>

      <section aria-label="Fulfillment risks">
        <h2 className="font-medium ds-text">Fulfillment risks ({risks.length})</h2>
        {risks.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No delayed shipments.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {risks.map((r) => (
                <li key={r.shipmentId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    <Link href={`/ontology/explore?q=${encodeURIComponent(r.shipmentKey)}`} className="font-medium underline ds-text">
                      {r.shipmentKey}
                    </Link>{" "}
                    <span className="ds-text-2">
                      exposes {r.qty} units — customers {r.customerLabels.length > 0 ? r.customerLabels.join(", ") : "none"}
                      {r.plantLabels.length > 0 ? `, plants ${r.plantLabels.join(", ")}` : ""}
                    </span>
                  </span>
                  <Link
                    href={`/ontology/actions?action=mfg_resolve_delay&object=${encodeURIComponent(r.shipmentId)}`}
                    className="rounded px-3 py-1.5 text-[#141413]"
                    style={{ background: "var(--accent)" }}
                  >
                    Resolve
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-label="Coverage shortfalls">
        <h2 className="font-medium ds-text">Coverage ({lots.length} lots)</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-6">
          {Object.entries(c).map(([k, v]) => (
            <div key={k} className="ds-panel rounded p-3 text-sm">
              <p className="font-mono text-2xl font-bold tabular-nums ds-text">{v}</p>
              <p className="ds-text-2">{k}</p>
            </div>
          ))}
        </div>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {lots.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <span>
                <Link href={`/ontology/explore?q=${encodeURIComponent(l.key)}`} className="font-medium underline ds-text">
                  {l.key}
                </Link>{" "}
                <span className="ds-text-2">
                  {l.coverageDays === null ? "coverage unknown" : `${l.coverageDays} days`}
                  {l.belowReorderPoint ? " — below reorder point" : ""}
                </span>
              </span>
              {l.belowReorderPoint && (
                <Link
                  href={`/ontology/actions?action=mfg_transfer_stock&object=${encodeURIComponent(l.id)}`}
                  className="rounded px-3 py-1.5 text-[#141413]"
                  style={{ background: "var(--accent)" }}
                >
                  Transfer
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Reorder suggestions">
        <h2 className="font-medium ds-text">Reorder suggestions ({overview.reorder.length})</h2>
        {overview.reorder.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No lot is below its reorder point.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
            {overview.reorder.map((r) => (
              <li key={r.lotId} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <Link href={`/ontology/explore?q=${encodeURIComponent(r.lotKey)}`} className="font-medium underline ds-text">
                    {r.lotKey}
                  </Link>{" "}
                  <span className="ds-text-2">
                    short {r.shortage}
                    {r.suggestedFromKey ? (
                      <> — source {r.suggestedFromKey} ({r.available} surplus)</>
                    ) : (
                      " — no surplus warehouse found"
                    )}
                  </span>
                </span>
                <Link
                  href={`/ontology/actions?action=mfg_transfer_stock&object=${encodeURIComponent(r.lotId)}`}
                  className="rounded px-3 py-1.5 text-[#141413]"
                  style={{ background: "var(--accent)" }}
                >
                  Transfer
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <CoverageChart overview={overview} />
        <ShipmentTimeline shipments={overview.shipments} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NetworkGraph graph={graph} />
        <SiteMap graph={graph} />
      </div>

      <section aria-label="Network detail">
        <h2 className="font-medium ds-text">Network ({graph.nodes.length} nodes, {graph.edges.length} edges)</h2>
        <ul className="mt-2 divide-y rounded ds-panel" style={{ borderColor: "var(--hairline)" }}>
          {graph.nodes
            .filter((n) => !region || n.region === region)
            .map((n) => {
              const out = graph.edges.filter((e) => e.fromId === n.id);
              return (
                <li key={n.id} className="p-3 text-sm">
                  <span className="font-medium ds-text">{n.label}</span>{" "}
                  <span className="ds-text-2">
                    {n.type}
                    {n.region ? ` — ${n.region}` : ""}
                  </span>
                  {out.length > 0 && (
                    <ul className="mt-1 space-y-1 pl-4 ds-text-2">
                      {out.map((e, i) => (
                        <li key={i}>
                          {e.linkKey} → {graph.nodes.find((x) => x.id === e.toId)?.label ?? e.toId}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
        </ul>
      </section>

      <p className="rounded p-3 text-xs ds-text-2 ds-panel">
        Prototype decision aid. Coverage is computed from imported feeds — check Ops for feed freshness before
        acting. Suggestions require human approval; nothing here writes back on its own.
      </p>
    </div>
  );
}
