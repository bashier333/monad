"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CANONICAL_FIELDS } from "@/lib/core/ingest/columns";
import { applyHeaderPreset, applyPreset, FREIGHT_PRESET_VENDORS, PRESETS } from "@/lib/core/ingest/presets";
import { AGENCY_FIELDS } from "@/lib/packs/agency/fields";
import { AGENCY_PRESETS } from "@/lib/packs/agency/presets";
import { isAgencySource } from "@/lib/packs/agency/sources";
import { trackFunnel } from "@/lib/analytics";

interface Props {
  runId: string;
  headers: string[];
  initialMapping: Record<string, number>;
  confidence: Record<string, number>;
  sourceType: string;
  samples: Array<{ rowNumber: number; data: Record<string, unknown> }>;
}

function confidenceTone(c: number | undefined): { label: string; color: string } {
  if (c === undefined) return { label: "unmapped", color: "var(--fg-2)" };
  const pct = `${Math.round(c * 100)}%`;
  if (c >= 0.8) return { label: pct, color: "var(--success)" };
  if (c >= 0.5) return { label: pct, color: "var(--warn)" };
  return { label: pct, color: "var(--danger)" };
}

export default function MappingReview({ runId, headers, initialMapping, confidence, sourceType, samples }: Props) {
  const [mapping, setMapping] = useState<Record<string, number | null>>({ ...initialMapping });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const agency = isAgencySource(sourceType);
  const fields: string[] = agency ? [...AGENCY_FIELDS] : [...CANONICAL_FIELDS];

  function applyVendor(vendor: string) {
    if (agency) {
      const preset = AGENCY_PRESETS.find((p) => p.vendor === vendor);
      if (preset) setMapping((m) => ({ ...m, ...applyHeaderPreset(headers, preset.headers) }));
    } else {
      const preset = PRESETS.find((p) => p.vendor === vendor);
      if (preset) setMapping((m) => ({ ...m, ...applyPreset(headers, preset) }));
    }
    setSaved(false);
  }

  const vendorOptions = agency
    ? AGENCY_PRESETS.map((p) => p.vendor)
    : PRESETS.map((p) => p.vendor).filter((v) => FREIGHT_PRESET_VENDORS.includes(v));

  async function save(thenGoToAnswers: boolean) {
    setSaving(true);
    const res = await fetch(`/api/imports/${runId}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping }),
    });
    setSaving(false);
    setSaved(res.ok);
    if (res.ok && thenGoToAnswers) {
      trackFunnel("mapping_confirmed", { runId });
      // Re-trigger the answer for the run week and land on it: mapping is
      // the last step before the numbers exist.
      router.push(isAgencySource(sourceType) ? "/answers/projects" : "/answers");
    }
  }

  return (
    <div className="rounded border p-4">
      <h2 className="font-medium">Column mapping</h2>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span>Vendor preset:</span>
        <select
          aria-label="Vendor preset"
          onChange={(e) => {
            if (e.target.value) applyVendor(e.target.value);
          }}
          className="rounded border p-1"
          defaultValue=""
        >
          <option value="">— none —</option>
          {vendorOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <table className="ds-table mt-2 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th scope="col" className="py-1 font-medium ds-text-2">Field</th>
            <th scope="col" className="font-medium ds-text-2">Column</th>
            <th scope="col" className="font-medium ds-text-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field: string) => (
            <tr key={field} className="border-t" style={{ borderColor: "var(--hairline)" }}>
              <td className="py-1 font-mono ds-text">{field}</td>
              <td>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({
                      ...m,
                      [field]: e.target.value === "" ? null : Number(e.target.value),
                    }))
                  }
                  className="rounded border p-1"
                >
                  <option value="">— unmapped —</option>
                  {headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {h || `(column ${idx + 1})`}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {(() => {
                  const t = confidenceTone(confidence[field]);
                  return (
                    <span
                      className="inline-block rounded border px-1.5 py-0.5 font-mono text-xs"
                      style={{ borderColor: "var(--hairline)", color: t.color }}
                    >
                      {t.label}
                    </span>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void save(true)}
          disabled={saving}
          className="ds-control rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#141413" }}
        >
          {saving ? "Confirming…" : "Confirm & see answer"}
        </button>
        <button
          onClick={() => void save(false)}
          disabled={saving}
          className="ds-control rounded border px-4 py-2 text-sm ds-text disabled:opacity-50"
          style={{ borderColor: "var(--hairline)" }}
        >
          Save mapping only
        </button>
        {saved && <span className="text-sm ds-text-2">Saved.</span>}
      </div>
      {samples.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium ds-text">Sample rows (first {samples.length})</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {samples.map((s) => (
              <li key={s.rowNumber} className="rounded border p-2 ds-text-2" style={{ borderColor: "var(--hairline)" }}>
                <span className="font-mono">row {s.rowNumber}</span>:{" "}
                {Object.entries(s.data)
                  .slice(0, 8)
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
