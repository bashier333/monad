"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Field } from "@/components/primitives";

export interface CreatorProp {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  config?: { options?: string[] } | null;
}

function inputFor(
  p: CreatorProp,
  value: string | boolean,
  set: (v: string | boolean) => void
) {
  const cls =
    "ds-control w-full rounded-md border px-3 py-2 text-sm ds-text";
  const style = { borderColor: "var(--hairline)", background: "var(--ground)" } as const;
  if (p.kind === "boolean") {
    return (
      <input type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} className="h-4 w-4" />
    );
  }
  if (p.kind === "enum") {
    const options = p.config?.options ?? [];
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => set(e.target.value)}
        className={cls}
        style={style}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (p.kind === "number" || p.kind === "currency" || p.kind === "percent" || p.kind === "integer") {
    return (
      <input
        type="number"
        value={String(value ?? "")}
        onChange={(e) => set(e.target.value)}
        step={p.kind === "integer" ? 1 : "any"}
        className={`${cls} font-mono`}
        style={style}
      />
    );
  }
  if (p.kind === "date") {
    return <input type="date" value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={cls} style={style} />;
  }
  if (p.kind === "datetime") {
    return (
      <input type="datetime-local" value={String(value ?? "")} onChange={(e) => set(e.target.value)} className={cls} style={style} />
    );
  }
  if (p.kind === "text" || p.kind === "json") {
    return (
      <textarea
        value={String(value ?? "")}
        onChange={(e) => set(e.target.value)}
        rows={2}
        className={cls}
        style={style}
      />
    );
  }
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => set(e.target.value)}
      autoComplete="off"
      className={cls}
      style={style}
    />
  );
}

// Object creator: the type's properties become the form, so owners add real
// objects (a van, a lane, a client) without touching JSON or the API.
// Validation and coercion happen server-side; failures name the property.
export default function ObjectCreator({ typeKey, properties }: { typeKey: string; properties: CreatorProp[] }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {};
      for (const p of properties) {
        const v = values[p.key];
        if (v === undefined || v === "" || v === false) continue;
        data[p.key] = v;
      }
      const res = await fetch("/api/ontology/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeKey, key: key.trim(), data }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setCreated(key.trim());
        setKey("");
        setValues({});
      } else {
        setError(body.error ?? "Could not create that object.");
      }
    } catch {
      setError("Could not create that object. Check your connection and try again.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        New {typeKey.replace(/_/g, " ")}
      </Button>
    );
  }

  return (
    <form onSubmit={(e) => void create(e)} className="space-y-3 rounded-[10px] border p-4" style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold ds-text">New {typeKey.replace(/_/g, " ")}</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline ds-text-2">
          Close
        </button>
      </div>
      <Field label="Key" hint="Unique id for this object, e.g. van-014">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="van-014"
          autoComplete="off"
          className="ds-control w-full rounded-md border px-3 py-2 font-mono text-sm ds-text"
          style={{ borderColor: "var(--hairline)", background: "var(--ground)" }}
        />
      </Field>
      {properties.length === 0 && (
        <p className="text-sm ds-text-2">This type has no properties yet. The key alone is enough.</p>
      )}
      {properties.map((p) => (
        <Field key={p.key} label={`${p.label || p.key}${p.required ? " (required)" : ""}`}>
          {inputFor(p, values[p.key] ?? "", (v) => setValues((s) => ({ ...s, [p.key]: v })))}
        </Field>
      ))}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {created && (
        <p role="status" className="text-sm ds-text-2">
          Created <Link href={`/ontology/explore?q=${encodeURIComponent(created)}`} className="underline ds-text">{created}</Link>.
        </p>
      )}
      <Button type="submit" busy={busy} disabled={busy || key.trim() === ""}>
        {busy ? "Creating…" : "Create object"}
      </Button>
    </form>
  );
}
