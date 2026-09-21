"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ObjectPicker, { type PickedObject } from "@/components/ObjectPicker";
import SpringIn from "@/components/motion";
import { stableKey } from "@/lib/idempotency";

interface FieldSpec {
  name: string;
  type: "string" | "integer" | "number" | "enum" | "datetime" | "object";
  required: boolean;
  options?: string[];
  refType?: string;
  hint?: string;
}

interface ActionDef {
  key: string;
  label: string;
  targetTypeKey: string;
  approvalPolicy: string;
  requiredCount: number;
  inputs: Record<string, unknown> & { fields?: FieldSpec[] };
}

type Phase =
  | { state: "idle" }
  | { state: "needs_approval"; approvalId: string }
  | { state: "approved"; approvalId: string }
  | { state: "executed"; message: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, body: parsed };
}

interface PreviewData {
  changes: Array<{ effect: string; before: unknown; after: unknown }>;
  effects?: Array<Record<string, unknown>>;
  approval: string;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = typeof value === "string" ? value : (value ?? "");
  if (field.type === "object") {
    const picked =
      typeof value === "string" && value
        ? { id: value, key: value, typeKey: field.refType ?? "" }
        : null;
    return (
      <ObjectPicker
        picked={picked}
        typeFilter={field.refType}
        onPick={(o) => onChange(o ? o.id : "")}
        placeholder={field.hint ?? `Pick ${field.refType ?? "object"}…`}
      />
    );
  }
  if (field.type === "enum") {
    return (
      <select
        value={String(str)}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="mt-1 block w-full rounded border px-3 py-2"
      >
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "integer" || field.type === "number") {
    return (
      <input
        type="number"
        value={String(str)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="mt-1 block w-full rounded border px-3 py-2"
      />
    );
  }
  if (field.type === "datetime") {
    // Timezone honesty: datetime-local has no zone, so the value is read as
    // UTC and stored with an explicit Z. Never silent midnight-local shift.
    return (
      <span className="mt-1 block">
        <input
          type="datetime-local"
          value={String(str).slice(0, 16)}
          onChange={(e) => onChange(e.target.value ? `${e.target.value}:00Z` : undefined)}
          className="block w-full rounded border px-3 py-2"
        />
        <span className="mt-0.5 block text-xs ds-text-2">
          {str ? `Stored as UTC: ${String(str)}` : "Entered time is read as UTC."}
        </span>
      </span>
    );
  }
  return (
    <input
      value={String(str)}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder={field.hint}
      className="mt-1 block w-full rounded border px-3 py-2"
    />
  );
}

export default function ActionRunner({ actions }: { actions: ActionDef[] }) {
  const params = useSearchParams();
  const [actionKey, setActionKey] = useState(params.get("action") ?? actions[0]?.key ?? "");
  const [picked, setPicked] = useState<PickedObject | null>(null);
  const [objectId, setObjectId] = useState(params.get("object") ?? "");
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>({ state: "idle" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const def = actions.find((a) => a.key === actionKey);
  const fields = def?.inputs?.fields;
  // Destructive tiers: reversible single-object writes execute directly;
  // anything requiring approval gets a scope modal first; rerouting (wide
  // blast radius, no undo) additionally requires typing the target key.
  // Never a generic "type DELETE" — the identifier is the object itself.
  const destructive = !!def && def.approvalPolicy !== "none";
  const needsTypedConfirm = actionKey === "mfg_reroute_shipment";
  const confirmTarget = picked?.key ?? objectId;
  const confirmReady =
    !needsTypedConfirm || confirmText.trim() === confirmTarget.trim();

  function requestExecute(approvalId?: string) {
    if (destructive && phase.state === "idle" && !confirmOpen) {
      setConfirmText("");
      setConfirmOpen(true);
      return;
    }
    setConfirmOpen(false);
    void run(approvalId);
  }

  useEffect(() => {
    const id = params.get("object");
    if (!id) return;
    fetch(`/api/ontology/objects/by-ids?ids=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((b: { objects?: Array<{ id: string; key: string; typeKey: string }> }) => {
        const o = b.objects?.[0];
        if (o) setPicked({ id: o.id, key: o.key, typeKey: o.typeKey });
      })
      .catch(() => undefined);
  }, [params]);

  useEffect(() => {
    setInputs({});
    setPreview(null);
    setResult("");
    setError("");
    setPhase({ state: "idle" });
  }, [actionKey]);

  useEffect(() => {
    if (picked) setObjectId(picked.id);
  }, [picked]);

  // Pasted ids resolve to a picked object first: executing against an
  // unknown id string is refused instead of failing deep in the engine.
  async function resolvePasted(): Promise<boolean> {
    if (picked || !objectId.trim()) return true;
    try {
      const res = await fetch(`/api/ontology/objects/by-ids?ids=${encodeURIComponent(objectId.trim())}`);
      const body = (await res.json()) as { objects?: Array<{ id: string; key: string; typeKey: string }> };
      const o = body.objects?.[0];
      if (o) {
        setPicked({ id: o.id, key: o.key, typeKey: o.typeKey });
        return true;
      }
    } catch {
      /* fall through to the error below */
    }
    setError("Unknown object id — pick from the list above instead of pasting.");
    return false;
  }

  async function showPreview() {
    setError("");
    setPreview(null);
    setBusy(true);
    try {
      if (!(await resolvePasted())) return;
      const { res, body } = await postJson("/api/ontology/actions/preview", { actionKey, objectId, inputs });
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "preview failed");
        return;
      }
      const p = body.preview as {
        effects?: Array<Record<string, unknown>>;
        approvalRequired?: boolean;
        approvalPolicy?: string;
        changes?: Array<{ effect: string; before: unknown; after: unknown }>;
        inputs?: Record<string, unknown>;
      };
      setPreview({
        changes: p.changes ?? [],
        effects: p.effects,
        approval: String(p.approvalPolicy ?? (p.approvalRequired ? "required" : "none")),
      });
    } finally {
      setBusy(false);
    }
  }

  async function run(approvalId?: string) {
    setError("");
    setResult("");
    setBusy(true);
    try {
      if (!(await resolvePasted())) return;
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(inputs)) if (v !== undefined && v !== "") clean[k] = v;
      const key = stableKey(actionKey, objectId, approvalId, clean);
      const { res, body } = await postJson("/api/ontology/actions/execute", {
        actionKey,
        objectId,
        inputs: clean,
        idempotencyKey: key,
        ...(approvalId ? { approvalId } : {}),
      });
      if (res.status === 409 || (res.status === 400 && body.needsApproval === true)) {
        const requested = await postJson("/api/ontology/approvals", { actionKey, objectId, inputs: clean });
        const approval = (requested.body.approval as { id?: string } | undefined)?.id;
        if (!requested.res.ok || !approval) {
          setError(typeof requested.body.error === "string" ? requested.body.error : "could not request approval");
          return;
        }
        setPhase({ state: "needs_approval", approvalId: approval });
        setResult(`Approval ${approval} requested. Approve below, then execute with approval.`);
        return;
      }
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "execution failed");
        return;
      }
      const run = body.run as { id?: string } | undefined;
      if (body.replayed === true) {
        const msg = `Already executed — showing the original receipt, no new effect. Run ${run?.id ?? "unknown"}.`;
        setPhase({ state: "executed", message: msg });
        setResult(msg);
      } else {
        setPhase({ state: "executed", message: `run ${run?.id}` });
        setResult(`run ${run?.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (phase.state !== "needs_approval") return;
    setError("");
    setBusy(true);
    try {
      const { res, body } = await postJson("/api/ontology/approvals", {
        id: phase.approvalId,
        approve: true,
        comment: "approved from actions console",
      });
      const approval = body.approval as { status?: string } | undefined;
      if (!res.ok || !approval) {
        setError(typeof body.error === "string" ? body.error : "approval failed (OWNER role required)");
        return;
      }
      setPhase({ state: "approved", approvalId: phase.approvalId });
      setResult(`Approval ${approval.status}. Execute with approval to write back.`);
    } finally {
      setBusy(false);
    }
  }

  if (actions.length === 0) return <p className="text-sm ds-text-2">No actions defined yet.</p>;
  const approvalId = phase.state === "needs_approval" || phase.state === "approved" ? phase.approvalId : undefined;
  const cleanInputs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(inputs)) if (v !== undefined && v !== "") cleanInputs[k] = v;
  const keyPreview = objectId ? stableKey(actionKey, objectId, approvalId, cleanInputs) : null;

  return (
    <div className="space-y-2 rounded ds-panel p-4">
      <h2 className="font-medium ds-text">Execute action</h2>
      <p className="text-sm ds-text-2">
        Change the model on purpose. Preview shows the before and after first; sensitive changes wait for an
        approval before they run.
      </p>
      <label className="block text-sm">
        Action
        <select value={actionKey} onChange={(e) => setActionKey(e.target.value)} className="mt-1 block w-full rounded border px-3 py-2">
          {actions.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} ({a.targetTypeKey}){a.approvalPolicy !== "none" ? ` — ${a.approvalPolicy} approval` : ""}
            </option>
          ))}
        </select>
      </label>
      {def && <p className="text-sm ds-text-2">{(def.inputs as { description?: string }).description ?? ""}</p>}
      {def && Array.isArray((def.inputs as { allowedRoles?: unknown }).allowedRoles) && (
        <p className="text-xs ds-text-2">
          roles: {((def.inputs as { allowedRoles: string[] }).allowedRoles).join(", ")}
          {(def.inputs as { latitude?: string }).latitude ? ` - latitude: ${(def.inputs as { latitude: string }).latitude}` : ""}
        </p>
      )}
      <div className="text-sm">
        <p className="mb-1">Target object</p>
        <ObjectPicker picked={picked} typeFilter={def?.targetTypeKey} onPick={setPicked} />
        <input
          value={objectId}
          onChange={(e) => setObjectId(e.target.value)}
          placeholder="…or paste an object id"
          className="mt-2 block w-full rounded border px-3 py-2"
        />
      </div>
      {fields && fields.length > 0 ? (
        <div className="space-y-2">
          {fields.map((f) => (
            <label key={f.name} className="block text-sm">
              {f.name}
              {f.required && <span className="text-red-600"> *</span>}
              {f.hint && <span className="ds-text-2"> — {f.hint}</span>}
              <FieldInput field={f} value={inputs[f.name]} onChange={(v) => setInputs((p) => ({ ...p, [f.name]: v }))} />
            </label>
          ))}
        </div>
      ) : (
        <label className="block text-sm">
          Inputs (JSON)
          <textarea
            value={JSON.stringify(inputs)}
            onChange={(e) => {
              try {
                setInputs(JSON.parse(e.target.value) as Record<string, unknown>);
              } catch {
                /* wait for valid JSON */
              }
            }}
            rows={3}
            className="mt-1 block w-full rounded border px-3 py-2 font-mono text-xs"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void showPreview()} disabled={busy || !objectId} className="rounded border px-4 py-2 text-sm disabled:opacity-50">
          Preview
        </button>
        <button
          onClick={() => requestExecute(approvalId)}
          disabled={busy || !objectId}
          className="rounded px-4 py-2 text-sm text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {phase.state === "approved" ? "Execute with approval" : "Execute"}
        </button>
        {phase.state === "needs_approval" && (
          <button onClick={() => void approve()} disabled={busy} className="rounded border px-4 py-2 text-sm disabled:opacity-50">
            Approve
          </button>
        )}
      </div>
      {confirmOpen && (
        <SpringIn y={8}>
        <div className="rounded border border-amber-600 p-3 text-sm" role="dialog" aria-label="Confirm write">
          <p className="font-medium">
            Confirm {def?.label ?? actionKey} on {confirmTarget || "…"}
          </p>
          <p className="mt-1 ds-text-2">
            This writes back to the model{def?.approvalPolicy !== "none" ? ` under ${def?.approvalPolicy} approval` : ""}.{" "}
            {needsTypedConfirm
              ? `Rerouting has a wide blast radius and no undo — type the target key (“${confirmTarget}”) to proceed.`
              : "Review the preview above first."}
          </p>
          {needsTypedConfirm && (
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmTarget}
              aria-label="Type the target key to confirm"
              className="mt-2 block w-full rounded border px-3 py-2 font-mono text-xs"
            />
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => requestExecute(approvalId)}
              disabled={busy || !confirmReady}
              className="rounded px-4 py-2 text-sm text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              Confirm & execute
            </button>
            <button onClick={() => setConfirmOpen(false)} className="rounded border px-4 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
        </SpringIn>
      )}
      {keyPreview && (
        <p className="font-mono text-xs ds-text-2" title="Same action + object + inputs always reuse this key: retries replay the original receipt instead of writing twice.">
          idempotency {keyPreview.slice(0, 40)}…
        </p>
      )}
      {preview && (
        <div className="rounded ds-panel-2 p-3 text-xs">
          {preview.changes.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="ds-text-2">
                  <th scope="col" className="py-0.5 pr-2 font-medium">Effect</th>
                  <th scope="col" className="py-0.5 pr-2 font-medium">Before</th>
                  <th scope="col" className="py-0.5 font-medium">After</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((c, i) => (
                  <tr key={i} className="border-t align-top" style={{ borderColor: "var(--hairline)" }}>
                    <td className="py-0.5 pr-2 font-mono ds-text">{c.effect}</td>
                    <td className="py-0.5 pr-2 font-mono ds-text-2">{JSON.stringify(c.before)}</td>
                    <td className="py-0.5 font-mono ds-text">{JSON.stringify(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="ds-text-2">No field changes predicted.</p>
          )}
          {preview.effects && (
            <p className="mt-1 font-mono ds-text-2">effects: {JSON.stringify(preview.effects)}</p>
          )}
          <p className="mt-1 ds-text-2">approval: {preview.approval}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {result && <p className="text-sm" style={{ color: "var(--success)" }}>{result}</p>}
    </div>
  );
}
