import Link from "next/link";
import type { ReactNode } from "react";

// Shared design vocabulary for the ontology workspace. Every component here
// consumes the warm-ink tokens (var(--ground/panel/hairline/fg/accent)) so
// light + dark both work with no per-usage theme code. Tables consume the
// density tokens (--row-h/--cell-py); statuses are never color-only.

// Empty / error / loading in one contract: title + body + one primary
// action. Loading renders a skeleton, never a bare spinner.
export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
  variant = "empty",
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
  variant?: "empty" | "error" | "loading";
}) {
  if (variant === "loading") {
    return (
      <div className="ds-panel animate-pulse rounded p-6" aria-hidden>
        <div className="mx-auto h-4 w-2/3 rounded ds-panel-2" />
        <div className="mx-auto mt-2 h-3 w-1/2 rounded ds-panel-2" />
      </div>
    );
  }
  return (
    <div className="ds-panel rounded border-dashed p-6 text-center" role={variant === "error" ? "alert" : undefined}>
      <p className="font-medium ds-text">{title}</p>
      <p className="mt-1 text-sm ds-text-2">{body}</p>
      <p className="mt-2 text-sm">
        <Link href={actionHref} className="underline ds-text">
          {actionLabel}
        </Link>
      </p>
    </div>
  );
}

export function StatCards({ stats }: { stats: Array<{ label: string; value: string; detail?: string; tone?: "good" | "bad" | "neutral" }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="ds-panel p-4">
          <p className="text-[13px] ds-text-2">{s.label}</p>
          <p
            className="mt-1 font-mono text-[22px] font-semibold tabular-nums leading-tight"
            style={{
              color:
                s.tone === "bad" ? "var(--danger)" : s.tone === "good" ? "var(--success)" : "var(--fg)",
            }}
            aria-label={`${s.label}: ${s.value}${s.tone === "bad" ? " (down)" : s.tone === "good" ? " (up)" : ""}`}
          >
            <span aria-hidden>{s.tone === "bad" ? "▼ " : s.tone === "good" ? "▲ " : ""}</span>
            {s.value}
          </p>
          {s.detail ? (
            <p className="mt-2 border-t pt-2 text-xs ds-text-2" style={{ borderColor: "var(--hairline)" }}>
              {s.detail}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Key-value metadata chip. Compound display for object facts; always text,
// never color-only.
export function Tag({ k, v, tone = "neutral" }: { k: string; v: string; tone?: "good" | "bad" | "info" | "neutral" }) {
  const color =
    tone === "good" ? "var(--success)" : tone === "bad" ? "var(--danger)" : tone === "info" ? "var(--info)" : "var(--fg-2)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs"
      style={{ border: "1px solid var(--hairline)", background: "var(--panel-2)", color }}
    >
      <span className="ds-text-2">{k}</span>
      <span className="ds-text">{v}</span>
    </span>
  );
}

// Dense data table: sticky header, scoped columns, right-aligned numerics
// with tabular figures, ellipsis + title tooltips, 1024px-safe via the
// region wrapper. Status cells must be pill + label (see Tag), never dots.
export function DataTable({
  columns,
  rows,
  caption,
  minWidth = 0,
}: {
  columns: Array<{ label: string; numeric?: boolean; scope?: "col" }>;
  rows: ReactNode[][];
  caption?: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded ds-panel" role="region" aria-label={caption ?? "Data table"} tabIndex={0}>
      <table className="ds-table w-full text-sm" style={minWidth > 0 ? { minWidth } : undefined}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0" style={{ background: "var(--panel)" }}>
          <tr className="text-left">
            {columns.map((c, i) => (
              <th
                key={i}
                scope={c.scope ?? "col"}
                className={`px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] ds-text-2 ${c.numeric ? "text-right font-mono tabular-nums" : ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--hairline)" }}>
          {rows.map((r, i) => (
            <tr key={i} className="ds-state">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`max-w-64 truncate px-3 ds-text ${columns[j]?.numeric ? "text-right font-mono tabular-nums" : ""}`}
                  title={typeof cell === "string" ? cell : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type OodaPhase = "observe" | "orient" | "decide" | "act";
export type PhaseState = "pending" | "running" | "paused" | "succeeded" | "failed" | "skipped" | "bypassed";

// OODA phase timeline for agent runs: four labeled phases with per-phase
// state. Loops and bypasses render as annotations, never forced waterfall.
export function PhaseTimeline({
  phases,
  note,
}: {
  phases: Array<{ phase: OodaPhase; state: PhaseState; detail?: string }>;
  note?: string;
}) {
  const dot: Record<PhaseState, string> = {
    pending: "var(--fg-2)",
    running: "var(--accent)",
    paused: "var(--warn)",
    succeeded: "var(--success)",
    failed: "var(--danger)",
    skipped: "var(--fg-2)",
    bypassed: "var(--info)",
  };
  return (
    <div>
      <ol className="flex items-center gap-1" aria-label="Run phases">
        {phases.map((p, i) => (
          <li key={p.phase} className="flex flex-1 items-center gap-1">
            <span
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs capitalize"
              style={{ border: "1px solid var(--hairline)" }}
              aria-label={`${p.phase}: ${p.state}${p.detail ? ` — ${p.detail}` : ""}`}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: dot[p.state] }}
              />
              <span className="ds-text">{p.phase}</span>
              <span className="ds-text-2">· {p.state}</span>
            </span>
            {i < phases.length - 1 && <span aria-hidden className="h-px flex-1" style={{ background: "var(--hairline)" }} />}
          </li>
        ))}
      </ol>
      {note ? <p className="mt-1 text-xs ds-text-2">{note}</p> : null}
    </div>
  );
}

// Proof strip: our own measured numbers only. Never customer outcomes,
// never projections — live data or nothing.
export function ProofStrip({ items }: { items: Array<{ label: string; value: string; detail?: string; href?: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((it) => {
        const body = (
          <>
            <dt className="text-[13px] ds-text-2">{it.label}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold tabular-nums ds-text">{it.value}</dd>
            {it.detail ? (
              <dd className="mt-2 border-t pt-2 text-xs ds-text-2" style={{ borderColor: "var(--hairline)" }}>
                {it.detail}
              </dd>
            ) : null}
          </>
        );
        return it.href ? (
          <Link key={it.label} href={it.href} className="ds-state ds-panel block p-4">
            {body}
          </Link>
        ) : (
          <div key={it.label} className="ds-panel p-4">
            {body}
          </div>
        );
      })}
    </dl>
  );
}
