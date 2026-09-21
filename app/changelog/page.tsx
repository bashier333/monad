const ENTRIES: Array<{ version: string; date: string; notes: string[] }> = [
  {
    version: "1.3.0",
    date: "2026-09-21",
    notes: [
      "UI 10x: 5-item nav with More sheet, ⌘K palette trigger, shortcuts modal, theme/density in nav.",
      "Answers: week-over-week deltas, all topic spotlights, paywall with one-click upgrade.",
      "Landing loads faster (optimized hero image); every surface shows the running version with update checks.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-21",
    notes: [
      "Live AI: DeepSeek answers from your data in the automation console — a human still confirms every action.",
      "First-run tour, interactive model map, beginner's help guide, and plainer wording on every screen.",
      "Dark-mode borders and button contrast fixed across the workspace.",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-09-21",
    notes: ["Fixes fresh-install boot: the packaged server now loads its database client correctly."],
  },
  {
    version: "1.1.0",
    date: "2026-09-21",
    notes: [
      "Ontology console: digital twin, agent with human-confirm actions, approvals inbox, audit trail, scenarios, ops boards.",
      "Desktop exe hardening: splash, health gate, dark mode, command palette, SQLite file mode.",
      "Governed engine: policy algebra, identity review, audit checkpoints, JSON + LinkML + SHACL blueprint export.",
      "Windows installer: assisted per-user setup, app icon, first-boot secrets, zero-config local database.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-09-18",
    notes: ["Pilot checklist with auto-stamps, /pilots page with kill-gate signals, landing page, pricing source of truth."],
  },
  {
    version: "0.11.0",
    date: "2026-09-18",
    notes: ["Pilot ops kit: agreement, call agenda, exit interview, kill-gate review docs."],
  },
  {
    version: "0.10.0",
    date: "2026-09-18",
    notes: ["Admin dashboard, failures + costs APIs, support / known-issues / changelog pages, rate limiting, access logs."],
  },
  {
    version: "0.9.0",
    date: "2026-09-18",
    notes: ["Coverage gate (97.6%), API contract suite, adversarial fixtures, stale-run sweeper, pilot SLA docs."],
  },
  {
    version: "0.8.0",
    date: "2026-09-18",
    notes: ["Stripe billing: checkout, portal, webhooks, free-tier limits, metering, read-only dunning."],
  },
  {
    version: "0.7.0",
    date: "2026-09-18",
    notes: ["Onboarding checklist, sample-week demo seed, settings, invites, export/delete everything."],
  },
  {
    version: "0.6.0",
    date: "2026-09-18",
    notes: ["Monday briefs with anomalies, new-since diff, feedback voting, email delivery, unsubscribe."],
  },
  {
    version: "0.5.0",
    date: "2026-09-18",
    notes: ["Corrections loop: flags, queue, standing rules with preview, aliases, re-run with adjustments."],
  },
  {
    version: "0.4.0",
    date: "2026-09-18",
    notes: ["Answers UI: lane table, drill-down with source pins, CSV export, share links, NL queries."],
  },
  {
    version: "0.3.0",
    date: "2026-09-18",
    notes: ["Margin engine: lane normalization, attribution rules, deterministic cent-exact rollups."],
  },
  {
    version: "0.2.0",
    date: "2026-09-18",
    notes: ["Ingest pipeline: upload, column detect, validation, dedupe, multi-source conflicts."],
  },
  {
    version: "0.1.0",
    date: "2026-09-18",
    notes: ["Foundations: auth, orgs, roles, CI, health, seed."],
  },
];

export default function ChangelogPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-sm">
      <h1 className="text-xl font-bold">Changelog</h1>
      {ENTRIES.map((e) => (
        <section key={e.version} className="rounded border p-3">
          <h2 className="font-medium">
            {e.version} — {e.date}
          </h2>
          <ul className="mt-1 list-disc pl-5">
            {e.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
