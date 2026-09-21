"use client";

import { useEffect, useMemo, useRef } from "react";
import { colorForType, toMapPoints } from "@/lib/packs/manufacturing/graph-view";
import type { TwinGraph } from "@/lib/packs/manufacturing/service";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Site map: plants and warehouses with coordinates, colored by type.
// Circle markers avoid bundled image assets. Nodes without coordinates are
// counted in the fallback note, never silently dropped.
export default function SiteMap({ graph }: { graph: TwinGraph }) {
  const ref = useRef<HTMLDivElement>(null);
  const { points, skipped } = useMemo(() => toMapPoints(graph.nodes), [graph]);

  useEffect(() => {
    const el = ref.current;
    if (!el || points.length === 0) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      const created = L.map(ref.current).setView([39.5, -98.35], 4);
      map = created;
      // Basemap follows the theme: OSM standard blazes under dark chrome,
      // so dark uses CARTO dark_matter (with its required attribution).
      // Offline exe without tiles shows markers on the empty container —
      // markers carry the meaning, tiles are decoration.
      const dark = document.documentElement.classList.contains("dark");
      if (dark) {
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"https://carto.com/attributions\">CARTO</a>",
        }).addTo(created);
      } else {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(created);
      }
      const bounds: Array<[number, number]> = [];
      for (const p of points) {
        L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color: colorForType(p.type),
          weight: 2,
          fillColor: colorForType(p.type),
          fillOpacity: 0.5,
        })
          .addTo(created)
          .bindPopup(
            `<strong>${escapeHtml(p.label)}</strong><br/>${escapeHtml(p.type)}${p.status ? ` - ${escapeHtml(p.status)}` : ""}<br/><a href="/ontology/explore?id=${encodeURIComponent(p.id)}">Open in explorer</a>`
          );
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length > 1) created.fitBounds(bounds, { padding: [24, 24] });
      else if (bounds[0]) created.setView(bounds[0], 10);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      const node = el;
      if (node) node.innerHTML = "";
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="rounded ds-panel p-4">
        <p className="text-sm font-medium ds-text">Site map</p>
        <p className="mt-1 text-sm ds-text-2">No sites carry coordinates yet. Add GeoLat and GeoLng columns to the plant and warehouse imports.</p>
      </div>
    );
  }

  return (
    <div className="rounded ds-panel p-3">
      <p className="mb-2 text-sm font-medium ds-text">Site map ({points.length} sites)</p>
      <div ref={ref} className="z-0 h-[380px] w-full overflow-hidden rounded" />
      {skipped > 0 && (
        <p className="mt-1 text-xs ds-text-2">{skipped} objects have no coordinates and are not plotted.</p>
      )}
    </div>
  );
}
