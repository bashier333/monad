"use client";

import { useEffect, useMemo, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { colorForType, toMapPoints } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraph } from "@/lib/packs/manufacturing/service";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Live 3D operations map: sites as pins on a pitched map, connected lanes
// as routes with dots traveling them. Tiles come from OpenFreeMap (no key);
// if tiles or WebGL are unavailable (offline exe), it degrades to a site
// list instead of a blank box. Nodes without coordinates are counted in the
// fallback note, never silently dropped.
export default function SiteMap({ graph }: { graph: TwinGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const { points, skipped } = useMemo(() => toMapPoints(graph.nodes), [graph.nodes]);
  const routes = useMemo(() => {
    const coords = new Map(points.map((p) => [p.id, p]));
    const out: Array<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; label: string }> = [];
    for (const e of graph.edges) {
      const a = coords.get(e.fromId);
      const b = coords.get(e.toId);
      if (a && b) out.push({ from: a, to: b, label: `${a.label} to ${b.label}` });
    }
    return out.slice(0, 60);
  }, [graph.edges, points]);

  useEffect(() => {
    const el = ref.current;
    if (!el || points.length === 0) return;
    let map: import("maplibre-gl").Map | null = null;
    let raf = 0;
    let cancelled = false;
    const movers: Array<{ el: HTMLDivElement; marker: import("maplibre-gl").Marker; a: [number, number]; b: [number, number]; t: number; speed: number }> = [];
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !ref.current) return;
      const dark = document.documentElement.classList.contains("dark");
      try {
        map = new maplibre.Map({
          container: ref.current,
          style: dark ? "https://tiles.openfreemap.org/styles/dark" : "https://tiles.openfreemap.org/styles/positron",
          center: [points[0]!.lng, points[0]!.lat],
          zoom: 4,
          pitch: 58,
          attributionControl: { compact: true },
        });
      } catch {
        return;
      }
      map.addControl(new maplibre.NavigationControl({ showCompass: true }), "top-right");
      for (const p of points) {
        const dot = document.createElement("div");
        dot.style.width = "14px";
        dot.style.height = "14px";
        dot.style.borderRadius = "50%";
        dot.style.background = colorForType(p.type);
        dot.style.border = "2px solid #fff";
        dot.style.boxShadow = "0 1px 6px rgba(0,0,0,.4)";
        new maplibre.Marker({ element: dot })
          .setLngLat([p.lng, p.lat])
          .setPopup(
            new maplibre.Popup({ offset: 12 }).setHTML(
              `<strong>${escapeHtml(p.label)}</strong><br/>${escapeHtml(p.type)}${p.status ? ` - ${escapeHtml(p.status)}` : ""}<br/><a href="/ontology/explore?id=${encodeURIComponent(p.id)}">Open in explorer</a>`
            )
          )
          .addTo(map);
      }
      if (routes.length > 0) {
        map.on("load", () => {
          if (!map || cancelled) return;
          map.addSource("lanes", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: routes.map((r) => ({
                type: "Feature",
                properties: { label: r.label },
                geometry: { type: "LineString", coordinates: [[r.from.lng, r.from.lat], [r.to.lng, r.to.lat]] },
              })),
            },
          });
          map.addLayer({
            id: "lanes",
            type: "line",
            source: "lanes",
            paint: { "line-color": dark ? "#8ecae6" : "#1d4ed8", "line-width": 2, "line-opacity": 0.65 },
          });
          const bounds = new maplibre.LngLatBounds();
          for (const p of points) bounds.extend([p.lng, p.lat]);
          try {
            map.fitBounds(bounds, { padding: 48, maxZoom: 6 });
          } catch {
            /* keep default view */
          }
        });
        // Traveling dots: one per route, looping end to end. This is the
        // "live" in the live map — motion our eyes read as current activity.
        routes.slice(0, 24).forEach((r, i) => {
          const el2 = document.createElement("div");
          el2.style.width = "8px";
          el2.style.height = "8px";
          el2.style.borderRadius = "50%";
          el2.style.background = "#fff";
          el2.style.border = "2px solid var(--accent, #1570ef)";
          const marker = new maplibre.Marker({ element: el2 }).setLngLat([r.from.lng, r.from.lat]);
          if (map) marker.addTo(map);
          movers.push({
            el: el2,
            marker,
            a: [r.from.lng, r.from.lat],
            b: [r.to.lng, r.to.lat],
            t: (i % 10) / 10,
            speed: 0.002 + (i % 5) * 0.0006,
          });
        });
        const tick = () => {
          if (cancelled || !map) return;
          for (const m of movers) {
            m.t += m.speed;
            if (m.t > 1) m.t -= 1;
            m.marker.setLngLat([m.a[0] + (m.b[0] - m.a[0]) * m.t, m.a[1] + (m.b[1] - m.a[1]) * m.t]);
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } else {
        const bounds = new maplibre.LngLatBounds();
        for (const p of points) bounds.extend([p.lng, p.lat]);
        try {
          if (points.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 6 });
          else map.setCenter([points[0]!.lng, points[0]!.lat]);
        } catch {
          /* keep default view */
        }
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      for (const m of movers) m.marker.remove();
      map?.remove();
      if (el) el.innerHTML = "";
    };
  }, [points, routes]);

  if (points.length === 0) {
    return (
      <div className="rounded ds-panel p-4">
        <p className="text-sm font-medium ds-text">Operations map</p>
        <p className="mt-1 text-sm ds-text-2">No sites carry coordinates yet. City names map automatically; anything else needs GeoLat and GeoLng columns.</p>
      </div>
    );
  }

  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">
        Operations map ({points.length} sites{routes.length > 0 ? `, ${routes.length} live routes` : ""})
      </p>
      <div ref={ref} className="z-0 h-[380px] w-full overflow-hidden rounded" />
      {skipped > 0 && (
        <p className="mt-1 text-xs ds-text-2">{skipped} objects have no coordinates and are not plotted.</p>
      )}
    </div>
  );
}
