// Customer-facing changelog. Rule: outcomes, not internals — no task
// counts, file paths, test tallies, or model IDs. Versions and dates stay
// exact; new releases prepend via `npm run release` (see scripts/release.ts).
const ENTRIES: Array<{ version: string; date: string; notes: string[] }> = [
  {
    version: "1.4.0",
    date: "2026-09-21",
    notes: [
      "Foundry connectors now write directly into ontology types with validation and audit",
      "Foundry listed under Our Software with Use in Ontology",
      "Windows download now serves 1.4.0",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-09-21",
    notes: [
      "Ontology Studio guides: Types, Links, Actions docs wired into the page",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-09-21",
    notes: [
      "A cleaner, calmer interface with a new blue accent and dashboard cards.",
      "Smoother motion throughout, with reduced-motion support for those who need it.",
      "Sign in with GitHub, plus a branded sign-in page.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09-21",
    notes: [
      "Simpler navigation: five destinations up top, everything else under More, with a command palette and keyboard shortcuts.",
      "Answers now show week-over-week changes and every spotlight view, with one-click upgrade when you hit free limits.",
      "A faster landing page, and every screen shows its version with update checks.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-21",
    notes: [
      "Live AI answers from your own data in the automation console — a human still confirms every action.",
      "A first-run tour, an interactive model map, a beginner's help guide, and plainer wording on every screen.",
      "Dark mode contrast fixed across the workspace.",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-09-21",
    notes: ["Fixes an installer bug where fresh installs would not start."],
  },
  {
    version: "1.1.0",
    date: "2026-09-21",
    notes: [
      "The operations console: digital twin, AI assistant with human-confirmed actions, approvals inbox, audit trail, scenarios, and ops boards.",
      "A desktop app for Windows with dark mode, command palette, and a zero-setup local database.",
      "A governed engine: approvals, audit checkpoints, and portable model exports.",
      "A guided Windows installer that sets everything up in minutes.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-09-18",
    notes: ["Pilot checklist, pilot tracking page, landing page, and pricing."],
  },
  {
    version: "0.11.0",
    date: "2026-09-18",
    notes: ["Pilot kit: agreement, call agenda, exit interview, and review docs."],
  },
  {
    version: "0.10.0",
    date: "2026-09-18",
    notes: ["Admin dashboard, support and known-issues pages, rate limiting, and access logs."],
  },
  {
    version: "0.9.0",
    date: "2026-09-18",
    notes: ["Stronger automated testing, messy-data handling, and pilot reliability docs."],
  },
  {
    version: "0.8.0",
    date: "2026-09-18",
    notes: ["Team billing: checkout, self-serve portal, free-tier limits, and usage metering."],
  },
  {
    version: "0.7.0",
    date: "2026-09-18",
    notes: ["Onboarding checklist, one-click sample data, settings, invites, and full data export."],
  },
  {
    version: "0.6.0",
    date: "2026-09-18",
    notes: ["Monday briefs with anomaly highlights, change diffs, feedback voting, and email delivery."],
  },
  {
    version: "0.5.0",
    date: "2026-09-18",
    notes: ["Corrections loop: flag a figure, review the queue, turn repeat fixes into standing rules."],
  },
  {
    version: "0.4.0",
    date: "2026-09-18",
    notes: ["Answers pages: lane table, drill-downs with source links, CSV export, share links, plain-English questions."],
  },
  {
    version: "0.3.0",
    date: "2026-09-18",
    notes: ["Margin engine: lane normalization, attribution rules, and exact rollups."],
  },
  {
    version: "0.2.0",
    date: "2026-09-18",
    notes: ["Upload messy exports: column auto-detect, mapping review, and duplicate handling."],
  },
  {
    version: "0.1.0",
    date: "2026-09-18",
    notes: ["Foundations: sign-in, organizations, roles, health checks, and sample data."],
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
