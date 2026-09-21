"use client";

import { useState } from "react";
import ObjectPicker, { type PickedObject } from "@/components/ObjectPicker";
import { impactSimulation } from "@/lib/packs/manufacturing/logic/impact";
import type { LotLite } from "@/lib/packs/manufacturing/logic/reorder";

interface BranchChange {
  objectId: string;
  baseVersion: number;
  data: Record<string, unknown>;
}

interface Branch {
  name: string;
  status: string;
  changes: BranchChange[];
  createdAt: string;
}

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body: parsed };
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface ABResult {
  aName: string;
  bName: string;
  aCov: number | null;
  bCov: number | null;
  aRisk: number;
  bRisk: number;
  aN: number;
  bN: number;
  riskWinner: string;
  covWinner: string;
}

export default function ScenarioManager({ initial }: { initial: Branch[] }) {
  const [branches, setBranches] = useState<Branch[]>(initial);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedObject | null>(null);
  const [property, setProperty] = useState("qty_on_hand");
  const [propertyOptions, setPropertyOptions] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [impact, setImpact] = useState("");
  const [compareWith, setCompareWith] = useState("");
  const [comparison, setComparison] = useState<ABResult | null>(null);

  // Schema select: property options come from the picked object's live data
  // keys — no free-text typos, no invented schema.
  async function pick(o: PickedObject | null) {
    setPicked(o);
    setPropertyOptions([]);
    if (!o) return;
    try {
      const list = await fetch(`/api/ontology/objects?type=${encodeURIComponent(o.typeKey)}&take=200`).then((r) => r.json()) as {
        rows?: Array<{ id: string; data: Record<string, unknown> }>;
      };
      const row = list.rows?.find((r) => r.id === o.id);
      const keys = row ? Object.keys(row.data).sort() : [];
      setPropertyOptions(keys);
      if (keys.length > 0 && !keys.includes(property)) setProperty(keys[0] as string);
    } catch {
      /* keep free text */
    }
  }

  const branch = branches.find((b) => b.name === selected) ?? null;

  async function refresh() {
    const res = await fetch("/api/ontology/branches");
    if (!res.ok) return;
    const body = (await res.json()) as { branches: Array<{ name: string; status: string; changes: BranchChange[]; createdAt: string }> };
    setBranches(
      body.branches.map((b) => ({ name: b.name, status: b.status, changes: b.changes ?? [], createdAt: String(b.createdAt).slice(0, 10) }))
    );
  }

  async function create() {
    setMessage("");
    const { res, body } = await postJson("/api/ontology/branches", { name: name.trim() });
    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "create failed");
      return;
    }
    setName("");
    setSelected((body.branch as { name?: string } | undefined)?.name ?? name.trim());
    await refresh();
  }

  async function stage() {
    if (!branch || !picked || !property) return;
    setMessage("");
    setImpact("");
    // Read the object's current version + data so the staged change carries baseVersion.
    const list = await fetch(`/api/ontology/objects?type=${encodeURIComponent(picked.typeKey)}&take=200`).then((r) => r.json()) as {
      rows?: Array<{ id: string; key: string; version: number; data: Record<string, unknown> }>;
    };
    const row = list.rows?.find((r) => r.id === picked.id);
    if (!row) {
      setMessage("object not found in its type listing");
      return;
    }
    const parsed: unknown = value.trim() === "" ? null : Number.isNaN(Number(value)) ? value : Number(value);
    const change = { objectId: picked.id, baseVersion: row.version, data: { ...row.data, [property]: parsed } };
    const { res, body } = await postJson("/api/ontology/branches/changes", { name: branch.name, change });
    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "stage failed");
      return;
    }
    setPicked(null);
    setValue("");
    await refresh();
    setMessage(`Staged ${property}=${value} on ${picked.key}.`);
  }

  async function fetchLots(): Promise<LotLite[] | null> {
    const list = await fetch("/api/ontology/objects?type=mfg_inventory_lot&take=200").then((r) => r.json()) as {
      rows?: Array<{ id: string; key: string; data: Record<string, unknown> }>;
    };
    return (list.rows ?? []).map((r) => ({
      id: r.id,
      key: r.key,
      data: {
        qty_on_hand: num(r.data.qty_on_hand) ?? 0,
        reorder_point: num(r.data.reorder_point),
        safety_stock: num(r.data.safety_stock),
        daily_demand: num(r.data.daily_demand),
      },
    }));
  }

  async function previewImpact() {
    if (!branch) return;
    setImpact("");
    setMessage("");
    const lots = await fetchLots();
    if (!lots || lots.length === 0) {
      setImpact("No inventory lots to simulate against.");
      return;
    }
    const r = impactSimulation(
      lots,
      branch.changes.map((c) => ({ objectId: c.objectId, data: c.data }))
    );
    setImpact(
      `Before: avg coverage ${r.before.avgCoverage ?? "?"} days, ${r.before.atRisk} at risk. After: avg coverage ${r.after.avgCoverage ?? "?"} days, ${r.after.atRisk} at risk. (${r.affected} staged changes applied.)`
    );
  }

  // A/B compare: this branch vs one other, same lots, same simulation.
  // Frozen KPI set (avg coverage, at-risk count), winner per metric. Cap is
  // two contenders — more degrades into noise.
  async function compare() {
    if (!branch || !compareWith) return;
    const other = branches.find((b) => b.name === compareWith);
    if (!other) {
      setMessage("Pick a second scenario to compare against.");
      return;
    }
    setComparison(null);
    setMessage("");
    const lots = await fetchLots();
    if (!lots || lots.length === 0) {
      setMessage("No inventory lots to simulate against.");
      return;
    }
    const a = impactSimulation(lots, branch.changes.map((c) => ({ objectId: c.objectId, data: c.data })));
    const b = impactSimulation(lots, other.changes.map((c) => ({ objectId: c.objectId, data: c.data })));
    const covA = a.after.avgCoverage ?? -1;
    const covB = b.after.avgCoverage ?? -1;
    setComparison({
      aName: branch.name,
      bName: other.name,
      aCov: a.after.avgCoverage,
      bCov: b.after.avgCoverage,
      aRisk: a.after.atRisk,
      bRisk: b.after.atRisk,
      aN: a.affected,
      bN: b.affected,
      riskWinner: a.after.atRisk === b.after.atRisk ? "tie" : a.after.atRisk < b.after.atRisk ? branch.name : other.name,
      covWinner: covA === covB ? "tie" : covA > covB ? branch.name : other.name,
    });
  }

  async function merge() {
    if (!branch) return;
    setMessage("");
    const { res, body } = await postJson("/api/ontology/branches/changes", { name: branch.name }, "PUT");
    if (!res.ok) {
      setMessage(typeof body.error === "string" ? body.error : "merge failed");
      return;
    }
    const outcome = body.outcome as { applied?: string[]; conflicts?: Array<{ objectId: string; reason: string }> } | undefined;
    const conflicts = outcome?.conflicts ?? [];
    const temporal = conflicts.filter((c) => c.reason.startsWith("temporal-rebase-required"));
    const other = conflicts.filter((c) => !c.reason.startsWith("temporal-rebase-required"));
    const parts = [`Merged: ${(outcome?.applied ?? []).length} applied, ${conflicts.length} conflicts.`];
    if (temporal.length > 0) {
      parts.push(
        `Interval edits need rebase, not overwrite (${temporal.map((c) => c.objectId).join(", ")}): refresh the branch from live state and re-stage — main moved underneath a validFrom/validTo change.`
      );
    }
    if (other.length > 0) {
      parts.push(`Other conflicts: ${other.map((c) => `${c.objectId} (${c.reason})`).join("; ")}`);
    }
    setMessage(parts.join(" "));
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="new branch name (e.g. peak-season)"
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button onClick={() => void create()} disabled={!name.trim()} className="whitespace-nowrap rounded px-4 py-2 text-sm text-[#141413] disabled:opacity-50"
            style={{ background: "var(--accent)" }}>
          Create
        </button>
      </div>
      {branches.length === 0 ? (
        <p className="rounded border border-dashed p-4 text-sm ds-text-2">No branches yet. Create one to stage what-if changes.</p>
      ) : (
        <ul className="divide-y rounded border">
          {branches.map((b) => (
            <li key={b.name}>
              <button
                onClick={() => setSelected(b.name)}
                aria-pressed={selected === b.name}
                className="ds-state block w-full p-3 text-left text-sm ds-text"
                style={selected === b.name ? { outline: "2px solid var(--accent)", outlineOffset: -2 } : undefined}
              >
                <span className="font-medium">{b.name}</span>{" "}
                <span className="ds-text-2">
                  {b.status} · {b.changes.length} staged · {b.createdAt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {branch && (
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-medium">Scenario: {branch.name}</h2>
          {branch.changes.length === 0 ? (
            <p className="text-sm ds-text-2">No staged changes.</p>
          ) : (
            <ul className="divide-y rounded border text-sm">
              {branch.changes.map((c, i) => (
                <li key={i} className="p-2">
                  <span className="font-mono text-xs">{c.objectId}</span>{" "}
                  <span className="ds-text-2">base v{c.baseVersion} → {JSON.stringify(c.data).slice(0, 160)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-52 flex-1">
              <ObjectPicker picked={picked} onPick={(o) => void pick(o)} />
            </div>
            {propertyOptions.length > 0 ? (
              <label className="text-sm ds-text-2">
                Property
                <select value={property} onChange={(e) => setProperty(e.target.value)} className="ml-1 w-40 rounded border px-2 py-2 text-sm ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}>
                  {propertyOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
            ) : (
              <input value={property} onChange={(e) => setProperty(e.target.value)} placeholder="property" aria-label="Property" className="w-36 rounded border px-2 py-2 text-sm ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }} />
            )}
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value" aria-label="Value" className="w-32 rounded border px-2 py-2 text-sm ds-text" style={{ borderColor: "var(--hairline)", background: "var(--ground)" }} />
            <button onClick={() => void stage()} disabled={!picked || !property} className="rounded border px-3 py-2 text-sm ds-text disabled:opacity-50" style={{ borderColor: "var(--hairline)" }}>
              Stage change
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void previewImpact()} className="rounded border px-3 py-2 text-sm">
              Preview impact
            </button>
            <button onClick={() => void merge()} disabled={branch.status !== "open"} className="rounded px-3 py-2 text-sm text-[#141413] disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              Merge to live
            </button>
          </div>
          {branches.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm ds-text-2">
                Compare against
                <select
                  value={compareWith}
                  onChange={(e) => setCompareWith(e.target.value)}
                  className="ml-2 rounded border px-2 py-2 text-sm"
                >
                  <option value="">—</option>
                  {branches
                    .filter((b) => b.name !== branch.name)
                    .map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name} ({b.changes.length} staged)
                      </option>
                    ))}
                </select>
              </label>
              <button onClick={() => void compare()} disabled={!compareWith} className="rounded border px-3 py-2 text-sm disabled:opacity-50">
                Compare A/B
              </button>
            </div>
          )}
          {impact && <p className="rounded ds-panel-2 p-3 text-sm ds-text">{impact}</p>}
          {comparison && (
            <table className="ds-table w-full text-sm">
              <caption className="sr-only">A/B scenario comparison</caption>
              <thead>
                <tr className="text-left">
                  <th scope="col" className="py-1 font-medium ds-text-2">Scenario</th>
                  <th scope="col" className="text-right font-medium ds-text-2">Avg coverage</th>
                  <th scope="col" className="text-right font-medium ds-text-2">At risk</th>
                  <th scope="col" className="text-right font-medium ds-text-2">Changes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: comparison.aName, cov: comparison.aCov, risk: comparison.aRisk, n: comparison.aN },
                  { name: comparison.bName, cov: comparison.bCov, risk: comparison.bRisk, n: comparison.bN },
                ].map((r) => (
                  <tr key={r.name} className="border-t" style={{ borderColor: "var(--hairline)" }}>
                    <td className="py-1 font-medium ds-text">
                      {r.name}
                      {comparison.riskWinner === r.name && <span className="ml-1 text-xs ds-text-2">fewer at risk</span>}
                      {comparison.covWinner === r.name && <span className="ml-1 text-xs ds-text-2">more coverage</span>}
                    </td>
                    <td className="text-right tabular-nums ds-text">{r.cov === null ? "?" : `${r.cov}d`}</td>
                    <td className="text-right tabular-nums ds-text">{r.risk}</td>
                    <td className="text-right tabular-nums ds-text-2">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {message && <p className="text-sm ds-text">{message}</p>}
        </div>
      )}
    </div>
  );
}
