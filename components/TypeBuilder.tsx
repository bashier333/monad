"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/primitives";

// Property kinds a non-technical owner can fill in without reading docs.
// Advanced kinds (reference, geo, file, json, computed, duration) stay
// API-only; the server validates whatever is sent.
const SIMPLE_KINDS = [
  "string",
  "text",
  "number",
  "integer",
  "currency",
  "percent",
  "boolean",
  "date",
  "datetime",
  "enum",
  "email",
  "url",
  "phone",
] as const;

interface PropRow {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  unique: boolean;
  options: string;
}

const blankProp = (): PropRow => ({ key: "", label: "", kind: "string", required: false, unique: false, options: "" });

function suggestKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 64);
}

// Type builder: owners define the nouns of their company right on the
// Schema page (key, label, properties) instead of hand-writing JSON or
// waiting on an import. Posts to the versioned type registry.
export default function TypeBuilder() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [props, setProps] = useState<PropRow[]>([blankProp()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  function setLabelAndKey(v: string) {
    setLabel(v);
    if (!keyTouched) setKey(suggestKey(v));
  }

  function setProp(i: number, patch: Partial<PropRow>) {
    setProps((ps) => {
      const next = [...ps];
      const cur = next[i]!;
      const merged = { ...cur, ...patch };
      if (patch.label !== undefined && !patch.key) {
        const s = suggestKey(patch.label);
        if (s) merged.key = s;
      }
      next[i] = merged;
      return next;
    });
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const properties = props
        .filter((p) => p.key.trim() !== "")
        .map((p) => ({
          key: p.key.trim(),
          label: p.label.trim() || p.key.trim(),
          kind: p.kind,
          required: p.required,
          unique: p.unique,
          ...(p.kind === "enum" && p.options.trim() !== ""
            ? { config: { options: p.options.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 50) } }
            : {}),
        }));
      const res = await fetch("/api/ontology/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim(), label: label.trim(), description: description.trim(), properties }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        problems?: Array<{ field?: string; message?: string }>;
        type?: { key?: string };
      };
      if (res.ok) {
        setCreated(body.type?.key ?? key.trim());
        setLabel("");
        setKey("");
        setKeyTouched(false);
        setDescription("");
        setProps([blankProp()]);
      } else {
        const detail = body.problems?.map((p) => p.message ?? p.field).filter(Boolean).join("; ");
        setError(body.error && body.error !== "invalid" ? body.error : detail || "Could not create that type.");
      }
    } catch {
      setError("Could not create that type. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        New type
      </Button>
    );
  }

  return (
    <form onSubmit={(e) => void create(e)} className="space-y-3 rounded-[10px] border p-4" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold ds-text">New type</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline ds-text-2">
          Close
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Label" hint="Human name, e.g. Delivery van">
          <input
            value={label}
            onChange={(e) => setLabelAndKey(e.target.value)}
            placeholder="Delivery van"
            autoComplete="off"
            className="ds-control w-full rounded-md border px-3 py-2 text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
        </Field>
        <Field label="Key" hint="snake_case, used by imports and the API">
          <input
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setKeyTouched(true);
            }}
            placeholder="delivery_van"
            autoComplete="off"
            className="ds-control w-full rounded-md border px-3 py-2 font-mono text-sm ds-text"
            style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
          />
        </Field>
      </div>
      <Field label="Description (optional)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this thing is in your company"
          autoComplete="off"
          className="ds-control w-full rounded-md border px-3 py-2 text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
      </Field>
      <div className="space-y-2">
        <p className="text-sm font-medium ds-text">Properties</p>
        {props.map((p, i) => (
          <div key={i} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_130px_auto_auto_auto]">
            <Field label={i === 0 ? "Label" : ""}>
              <input
                value={p.label}
                onChange={(e) => setProp(i, { label: e.target.value })}
                placeholder="Payload weight"
                autoComplete="off"
                aria-label={`Property ${i + 1} label`}
                className="ds-control w-full rounded-md border px-2 py-1.5 text-sm ds-text"
                style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
              />
            </Field>
            <Field label={i === 0 ? "Key" : ""}>
              <input
                value={p.key}
                onChange={(e) => setProp(i, { key: e.target.value })}
                placeholder="payload_weight"
                autoComplete="off"
                aria-label={`Property ${i + 1} key`}
                className="ds-control w-full rounded-md border px-2 py-1.5 font-mono text-sm ds-text"
                style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
              />
            </Field>
            <Field label={i === 0 ? "Kind" : ""}>
              <select
                value={p.kind}
                onChange={(e) => setProp(i, { kind: e.target.value })}
                aria-label={`Property ${i + 1} kind`}
                className="ds-control w-full rounded-md border px-2 py-1.5 text-sm ds-text"
                style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
              >
                {SIMPLE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-1 pb-2 text-[13px] ds-text-2">
              <input type="checkbox" checked={p.required} onChange={(e) => setProp(i, { required: e.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-1 pb-2 text-[13px] ds-text-2">
              <input type="checkbox" checked={p.unique} onChange={(e) => setProp(i, { unique: e.target.checked })} />
              Unique
            </label>
            <button
              type="button"
              onClick={() => setProps((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [blankProp()]))}
              aria-label={`Remove property ${i + 1}`}
              className="mb-2 rounded border px-2 py-1 text-sm ds-text-2"
              style={{ borderColor: "var(--hairline)" }}
            >
              ×
            </button>
            {p.kind === "enum" && (
              <div className="md:col-span-6">
                <Field label="Options (comma separated)">
                  <input
                    value={p.options}
                    onChange={(e) => setProp(i, { options: e.target.value })}
                    placeholder="active, idle, retired"
                    autoComplete="off"
                    className="ds-control w-full rounded-md border px-2 py-1.5 text-sm ds-text"
                    style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
                  />
                </Field>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setProps((ps) => [...ps, blankProp()])}
          className="rounded border px-2 py-1 text-sm ds-text"
          style={{ borderColor: "var(--hairline)" }}
        >
          + Add property
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {created && (
        <p role="status" className="text-sm ds-text-2">
          Created <Link href={`/ontology/${encodeURIComponent(created)}`} className="underline ds-text">{created}</Link>. Add its first object there.
        </p>
      )}
      <Button type="submit" busy={busy} disabled={busy || label.trim() === "" || key.trim() === ""}>
        {busy ? "Creating…" : "Create type"}
      </Button>
    </form>
  );
}
