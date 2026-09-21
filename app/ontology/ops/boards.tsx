"use client";

import { useState } from "react";

interface Policy {
  id: string;
  typeKey: string;
  effect: string;
  field: string;
  op: string;
  priority: number;
  active: boolean;
}

interface Playbook {
  id: string;
  name: string;
  schedule: string | null;
  enabled: boolean;
  lastRun: { status: string; at: string } | null;
}

interface Alert {
  id: string;
  pack: string;
  metric: string;
  op: string;
  threshold: number;
  channel: string;
  owner: string;
  responseAction: string;
  windowMinutes: number;
  active: boolean;
}

interface Webhook {
  id: string;
  actionKey: string;
  url: string;
  active: boolean;
  lastStatus: number | null;
  lastAt: string | null;
}

async function postJson(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body: parsed };
}

export default function OpsBoards({
  initialPolicies,
  initialPlaybooks,
  initialAlerts,
  initialWebhooks,
  verbs,
}: {
  initialPolicies: Policy[];
  initialPlaybooks: Playbook[];
  initialAlerts: Alert[];
  initialWebhooks: Webhook[];
  verbs: string[];
}) {
  const [policies] = useState(initialPolicies);
  const [playbooks] = useState(initialPlaybooks);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [hookForm, setHookForm] = useState({ actionKey: verbs[0] ?? "", url: "", secret: "" });
  const [simType, setSimType] = useState("mfg_inventory_lot");
  const [simRow, setSimRow] = useState('{"qty_on_hand": 40}');
  const [simResult, setSimResult] = useState("");
  const [alertForm, setAlertForm] = useState({ pack: "manufacturing", metric: "coverage", op: "<", threshold: "7", channel: "inapp", owner: "", responseAction: "", windowMinutes: "1440" });
  const [notice, setNotice] = useState("");

  async function simulate() {
    setSimResult("");
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(simRow) as Record<string, unknown>;
    } catch {
      setSimResult("row must be valid JSON");
      return;
    }
    const { res, body } = await postJson("/api/ontology/policies/simulate", { typeKey: simType, row });
    if (!res.ok) {
      setSimResult(typeof body.error === "string" ? body.error : "simulation failed");
      return;
    }
    setSimResult(body.allowed === true ? "ALLOWED" : "DENIED");
  }

  async function runPlaybook(id: string) {
    setNotice("");
    const { res, body } = await postJson(`/api/playbooks/${id}`, { dryRun: false });
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "run failed");
      return;
    }
    setNotice(`playbook ${String((body as { status?: string }).status ?? "done")}`);
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const { res, body } = await postJson("/api/webhooks", {
      actionKey: hookForm.actionKey,
      url: hookForm.url,
      secret: hookForm.secret || undefined,
    });
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "webhook create failed");
      return;
    }
    const hook = body.webhook as Webhook;
    setWebhooks((w) => [{ ...hook, lastStatus: null, lastAt: null }, ...w.filter((x) => x.id !== hook.id)]);
    setHookForm((f) => ({ ...f, url: "", secret: "" }));
  }

  async function toggleWebhook(id: string, active: boolean) {
    const { res, body } = await postJson("/api/webhooks", { id, active }, "PATCH");
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "toggle failed");
      return;
    }
    setWebhooks((w) => w.map((h) => (h.id === id ? { ...h, active } : h)));
  }

  async function deleteWebhook(id: string) {
    const res = await fetch(`/api/webhooks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice("delete failed");
      return;
    }
    setWebhooks((w) => w.filter((h) => h.id !== id));
  }

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    const { res, body } = await postJson("/api/alerts", {
      pack: alertForm.pack,
      metric: alertForm.metric,
      op: alertForm.op,
      threshold: Number(alertForm.threshold),
      channel: alertForm.channel,
      owner: alertForm.owner,
      responseAction: alertForm.responseAction,
      windowMinutes: Number(alertForm.windowMinutes),
    });
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "create failed");
      return;
    }
    const rule = body.rule as Alert;
    setAlerts((a) => [rule, ...a]);
  }

  async function toggleAlert(id: string, active: boolean) {
    const { res, body } = await postJson("/api/alerts", { id, active }, "PATCH");
    if (!res.ok) {
      setNotice(typeof body.error === "string" ? body.error : "toggle failed");
      return;
    }
    setAlerts((a) => a.map((r) => (r.id === id ? { ...r, active } : r)));
  }

  async function deleteAlert(id: string) {
    const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setNotice("delete failed");
      return;
    }
    setAlerts((a) => a.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      {notice && <p className="rounded border p-3 text-sm">{notice}</p>}

      <section>
        <h2 className="font-medium ds-text">Row policies ({policies.length})</h2>
        <ul className="mt-2 divide-y rounded ds-panel text-sm" style={{ borderColor: "var(--hairline)" }}>
          {policies.map((p) => (
            <li key={p.id} className="p-3">
              <span className="font-medium" style={{ color: p.effect === "deny" ? "var(--danger)" : "var(--success)" }}>{p.effect}</span>{" "}
              <span className="ds-text">{p.typeKey}</span>{" "}
              <span className="font-mono text-xs ds-text-2">{p.field || "(all rows)"} {p.op} #{p.priority}</span>{" "}
              {!p.active && <span className="ds-text-2">(inactive)</span>}
            </li>
          ))}
          {policies.length === 0 && <li className="p-3 ds-text-2">No policies. Reads on guarded types are denied by default.</li>}
        </ul>
        <div className="mt-3 space-y-2 rounded border p-3">
          <h3 className="text-sm font-medium">Simulate a row</h3>
          <div className="flex flex-wrap gap-2">
            <input value={simType} onChange={(e) => setSimType(e.target.value)} placeholder="type key" className="w-48 rounded border px-2 py-1.5 text-sm" />
            <input value={simRow} onChange={(e) => setSimRow(e.target.value)} placeholder='{"qty_on_hand": 40}' className="min-w-64 flex-1 rounded border px-2 py-1.5 font-mono text-sm" />
            <button onClick={() => void simulate()} className="rounded border px-3 py-1.5 text-sm">
              Simulate
            </button>
          </div>
          {simResult && <p className={`text-sm font-medium ${simResult === "ALLOWED" ? "text-green-700" : "text-red-700"}`}>{simResult}</p>}
        </div>
      </section>

      <section>
        <h2 className="font-medium ds-text">Playbooks ({playbooks.length})</h2>
        {playbooks.length === 0 ? (
          <p className="mt-2 rounded border border-dashed p-4 text-sm ds-text-2" style={{ borderColor: "var(--hairline)" }}>No playbooks. Create one from /api/playbooks or the starters.</p>
        ) : (
          <ul className="mt-2 divide-y rounded ds-panel text-sm" style={{ borderColor: "var(--hairline)" }}>
            {playbooks.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium ds-text">{p.name}</span>{" "}
                  <span className="ds-text-2">
                    {p.schedule ? `cron ${p.schedule}` : "manual only"}
                    {p.lastRun ? ` · last ${p.lastRun.status} ${p.lastRun.at}` : " · never run"}
                    {!p.enabled && " · disabled"}
                  </span>
                </span>
                <button onClick={() => void runPlaybook(p.id)} className="rounded px-3 py-1.5 text-[#141413]"
          style={{ background: "var(--accent)" }}>
                  Run now
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium ds-text">Alert rules ({alerts.length})</h2>
        <form onSubmit={(e) => void createAlert(e)} className="mt-2 flex flex-wrap items-end gap-2 rounded border p-3 text-sm">
          <label>
            Pack
            <select value={alertForm.pack} onChange={(e) => setAlertForm((f) => ({ ...f, pack: e.target.value }))} className="ml-2 rounded border px-2 py-1.5">
              <option value="manufacturing">manufacturing</option>
              <option value="freight">freight</option>
              <option value="agency">agency</option>
            </select>
          </label>
          <label>
            Metric
            <select value={alertForm.metric} onChange={(e) => setAlertForm((f) => ({ ...f, metric: e.target.value }))} className="ml-2 rounded border px-2 py-1.5">
              <option value="coverage">coverage</option>
              <option value="margin">margin</option>
              <option value="cost">cost</option>
            </select>
          </label>
          <label>
            Op
            <select value={alertForm.op} onChange={(e) => setAlertForm((f) => ({ ...f, op: e.target.value }))} className="ml-2 rounded border px-2 py-1.5">
              <option value="<">&lt;</option>
              <option value=">">&gt;</option>
            </select>
          </label>
          <label>
            Threshold
            <input value={alertForm.threshold} onChange={(e) => setAlertForm((f) => ({ ...f, threshold: e.target.value }))} type="number" className="ml-2 w-24 rounded border px-2 py-1.5" />
          </label>
          <label>
            Channel
            <select value={alertForm.channel} onChange={(e) => setAlertForm((f) => ({ ...f, channel: e.target.value }))} className="ml-2 rounded border px-2 py-1.5">
              <option value="inapp">inapp</option>
              <option value="email">email</option>
            </select>
          </label>
          <label>
            Owner (who responds)
            <input value={alertForm.owner} onChange={(e) => setAlertForm((f) => ({ ...f, owner: e.target.value }))} placeholder="planner-on-duty" className="ml-2 w-36 rounded border px-2 py-1.5" />
          </label>
          <label>
            Required action
            <input value={alertForm.responseAction} onChange={(e) => setAlertForm((f) => ({ ...f, responseAction: e.target.value }))} placeholder="Check the lane and reroute" className="ml-2 w-52 rounded border px-2 py-1.5" />
          </label>
          <label>
            Window (min)
            <input value={alertForm.windowMinutes} onChange={(e) => setAlertForm((f) => ({ ...f, windowMinutes: e.target.value }))} type="number" min={5} max={10080} className="ml-2 w-24 rounded border px-2 py-1.5" />
          </label>
          <button type="submit" className="rounded px-3 py-1.5 text-[#141413]"
          style={{ background: "var(--accent)" }}>
            Create rule
          </button>
        </form>
        {alerts.length > 0 && (
          <ul className="mt-2 divide-y rounded ds-panel text-sm" style={{ borderColor: "var(--hairline)" }}>
            {alerts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium ds-text">{r.pack}</span> <span className="ds-text-2">{r.metric} {r.op} {r.threshold} → {r.channel}</span>{" "}
                  {!r.active && <span className="ds-text-2">(inactive)</span>}
                  <span className="block text-xs ds-text-2">
                    owner {r.owner || "—"} · {r.windowMinutes}m · {r.responseAction || "no documented action"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button onClick={() => void toggleAlert(r.id, !r.active)} className="rounded border px-2 py-1 text-xs">
                    {r.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => void deleteAlert(r.id)} className="rounded border px-2 py-1 text-xs">
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium ds-text">Pre-commit webhooks ({webhooks.length})</h2>
        <p className="mt-1 text-sm ds-text-2">
          Signed POST before the write commits. Non-2xx or timeout blocks the action.
        </p>
        <form onSubmit={(e) => void createWebhook(e)} className="mt-2 flex flex-wrap items-end gap-2 rounded border p-3 text-sm">
          <label>
            Action
            <select value={hookForm.actionKey} onChange={(e) => setHookForm((f) => ({ ...f, actionKey: e.target.value }))} className="ml-2 rounded border px-2 py-1.5">
              {verbs.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-64 flex-1">
            URL
            <input
              value={hookForm.url}
              onChange={(e) => setHookForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://erp.example.com/hook"
              className="ml-2 w-full rounded border px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <label>
            Secret
            <input
              value={hookForm.secret}
              onChange={(e) => setHookForm((f) => ({ ...f, secret: e.target.value }))}
              placeholder="hmac secret (optional)"
              type="password"
              autoComplete="new-password"
              className="ml-2 w-44 rounded border px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <button type="submit" className="rounded px-3 py-1.5 text-[#141413]"
          style={{ background: "var(--accent)" }}>
            Save webhook
          </button>
        </form>
        {webhooks.length > 0 && (
          <ul className="mt-2 divide-y rounded border text-sm">
            {webhooks.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span>
                  <span className="font-medium ds-text">{h.actionKey}</span>{" "}
                  <span className="font-mono text-xs ds-text-2">{h.url}</span>{" "}
                  <span className="ds-text-2">
                    {h.lastStatus === null || h.lastStatus === undefined
                      ? "never delivered"
                      : h.lastStatus === -1
                        ? "last delivery failed"
                        : `last ${h.lastStatus}`}
                    {!h.active && " (inactive)"}
                  </span>
                </span>
                <span className="flex gap-2">
                  <button onClick={() => void toggleWebhook(h.id, !h.active)} className="rounded border px-2 py-1 text-xs">
                    {h.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => void deleteWebhook(h.id)} className="rounded border px-2 py-1 text-xs">
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
