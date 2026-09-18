"use client";

import { useState } from "react";
import { CANONICAL_FIELDS, type CanonicalField } from "@/lib/core/ingest/columns";
import { applyPreset, PRESETS } from "@/lib/core/ingest/presets";

interface Props {
  runId: string;
  headers: string[];
  initialMapping: Record<string, number>;
  confidence: Record<string, number>;
}

export default function MappingReview({ runId, headers, initialMapping, confidence }: Props) {
  const [mapping, setMapping] = useState<Record<string, number | null>>({ ...initialMapping });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/imports/${runId}/mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping }),
    });
    setSaving(false);
    setSaved(res.ok);
  }

  return (
    <div className="rounded border p-4">
      <h2 className="font-medium">Column mapping</h2>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span>Vendor preset:</span>
        <select
          aria-label="Vendor preset"
          onChange={(e) => {
            const preset = PRESETS.find((p) => p.vendor === e.target.value);
            if (preset) setMapping((m) => ({ ...m, ...applyPreset(headers, preset) }));
            setSaved(false);
          }}
          className="rounded border p-1"
          defaultValue=""
        >
          <option value="">— none —</option>
          {PRESETS.map((p) => (
            <option key={p.vendor} value={p.vendor}>
              {p.vendor}
            </option>
          ))}
        </select>
      </div>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Field</th>
            <th>Column</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {CANONICAL_FIELDS.map((field: CanonicalField) => (
            <tr key={field} className="border-t">
              <td className="py-1 font-mono">{field}</td>
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
              <td>{confidence[field] !== undefined ? `${Math.round(confidence[field] * 100)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save mapping"}
      </button>
      {saved && <span className="ml-2 text-sm text-green-700">Saved.</span>}
    </div>
  );
}
