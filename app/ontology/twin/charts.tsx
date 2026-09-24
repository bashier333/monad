"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { TwinOverview } from "@/lib/packs/manufacturing/service";

interface ChartTheme {
  danger: string;
  success: string;
  hairline: string;
  tick: string;
  panel: string;
  fg: string;
}

function readTheme(): ChartTheme {
  if (typeof document === "undefined") {
    return { danger: "#f0665f", success: "#3fb97f", hairline: "#232a33", tick: "#a8b0ba", panel: "#121519", fg: "#e8eaed" };
  }
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    danger: v("--danger", "#f0665f"),
    success: v("--success", "#3fb97f"),
    hairline: v("--hairline", "#232a33"),
    tick: v("--fg-2", "#a8b0ba"),
    panel: v("--panel", "#121519"),
    fg: v("--fg", "#e8eaed"),
  };
}

// SVG presentation attributes don't reliably resolve var(), so snapshot the
// computed tokens to hexes. Re-reads when the theme class flips (the toggle
// writes .dark on <html>), keeping charts correct in both themes.
function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => readTheme());
  useEffect(() => {
    setTheme(readTheme());
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function CoverageChart({ overview }: { overview: TwinOverview }) {
  const t = useChartTheme();
  const data = overview.coverage.map((c) => ({
    key: c.key.length > 14 ? `${c.key.slice(0, 13)}…` : c.key,
    days: c.coverageDays ?? 0,
    atRisk: c.belowReorderPoint,
  }));
  if (data.length === 0) return null;
  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">Coverage by lot (days)</p>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.hairline} />
            <XAxis dataKey="key" tick={{ fontSize: 11, fill: t.tick }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: t.tick }} />
            <Tooltip contentStyle={{ background: t.panel, border: `1px solid ${t.hairline}`, color: t.fg, fontSize: 12 }} />
            <Bar dataKey="days">
              {data.map((d, i) => (
                <Cell key={i} fill={d.atRisk ? t.danger : t.success} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ShipmentTimeline({ shipments }: { shipments: Array<{ key: string; status: string; eta: string | null }> }) {
  const t = useChartTheme();
  const now = Date.now();
  const data = shipments
    .filter((s) => s.eta)
    .map((s) => ({
      key: s.key,
      days: Math.round(((new Date(s.eta!).getTime() - now) / 86_400_000) * 10) / 10,
      status: s.status,
    }));
  if (data.length === 0) return null;
  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">Shipment ETAs (days from now)</p>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.hairline} />
            <XAxis dataKey="key" tick={{ fontSize: 11, fill: t.tick }} interval={0} angle={-30} textAnchor="end" height={60} allowDuplicatedCategory={false} />
            <YAxis dataKey="days" tick={{ fontSize: 11, fill: t.tick }} />
            <Tooltip contentStyle={{ background: t.panel, border: `1px solid ${t.hairline}`, color: t.fg, fontSize: 12 }} />
            <ReferenceLine y={0} stroke={t.hairline} />
            <Scatter data={data} fill={t.success} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
