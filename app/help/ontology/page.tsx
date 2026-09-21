import Link from "next/link";

// Plain-English guide to the ontology workspace. Assumes no database
// knowledge: nouns are things, verbs are doings, and every page answers one
// of three questions — what is true, what should change, was it decided well.
const GLOSSARY: Array<[string, string]> = [
  ["Object", "One specific thing: a single lot, one shipment, one customer."],
  ["Object type", "A kind of thing: all lots share the Inventory lot type."],
  ["Property", "A fact about a thing: quantity on hand, status, ETA."],
  ["Link", "A relationship between two things: this lot sits in that warehouse."],
  ["Action", "Something you may do: transfer stock, reroute a shipment. Actions can change data; everything else can only look."],
  ["Approval", "A required second opinion before a sensitive action runs. You approve or reject with a reason."],
  ["Latitude", "How much freedom an action allows the AI: propose-only, or confirmable without a second approval. Nothing ever runs silently."],
  ["Scenario", "A what-if copy of the data. Try changes there, compare outcomes, then merge — the live model stays untouched until you decide."],
  ["Policy", "A visibility or permission rule: who may see or touch which things. Denials always win over permissions."],
  ["Audit trail", "The tamper-evident log of everything that changed, who did it, and the before/after values. Verifiable on demand."],
  ["Digital twin", "This page's live model of your operation: what each site holds, what is moving, who is exposed."],
  ["Pack", "A ready-made model for one business: manufacturing, freight, or agency. Seeding a pack creates its types, links, and actions."],
];

const FAQS: Array<[string, string]> = [
  [
    "Do I need to know databases or queries?",
    "No. Search, click, and read. Every figure links to the objects behind it, and the model board on the Schema page shows how it all connects.",
  ],
  [
    "Will the AI change my data on its own?",
    "Never. The AI reads your data, shows its work with citations, and proposes actions. Nothing writes back until a human confirms — sensitive actions additionally need an approval.",
  ],
  [
    "What happens if I reject something?",
    "Rejections need a reason and are recorded like everything else. A rejected proposal simply never runs; the audit trail shows who declined it and why.",
  ],
  [
    "What is a scenario, and is it safe to experiment?",
    "A scenario is a sandbox copy. Stage changes, preview their impact, compare two scenarios side by side, and merge only when satisfied. Merging a conflicting change is blocked, never silently overwritten.",
  ],
  [
    "What does a verified audit chain mean?",
    "Every event cryptographically links to the previous one, so tampering anywhere breaks the chain everywhere after it. “Verify” replays those links; daily checkpoints anchor them for fast re-checks.",
  ],
  [
    "Where is my data, and who can see it?",
    "In your organization's database — Postgres you operate, or a local file for the desktop app. Visibility policies filter every read by your role, and the AI only ever sees what you may see.",
  ],
];

export default function OntologyHelpPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 text-sm md:p-8">
      <p className="text-sm">
        <Link href="/help" className="underline ds-text">
          Help
        </Link>{" "}
        <span className="ds-text-2">/ Understanding your business model</span>
      </p>
      <div>
        <h1 className="font-serif text-xl font-bold ds-text">Understanding your business model</h1>
        <p className="mt-2 ds-text-2">
          This app keeps one live model of your operation. It has <span className="ds-text">nouns</span> (the
          things: plants, lots, shipments, customers), <span className="ds-text">relationships</span> between
          them (this lot sits in that warehouse), and <span className="ds-text">verbs</span> (the doings:
          transfer stock, reroute a shipment). Reading is always free; changing always goes through an action
          with rules, and sensitive ones wait for a human.
        </p>
      </div>

      <section aria-label="First ten minutes">
        <h2 className="font-medium ds-text">Your first ten minutes</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li className="ds-text-2">
            <Link href="/ontology/twin" className="underline ds-text">Open the Twin</Link> — read the three
            decision lists top to bottom: what is at risk, what is short, what to reorder.
          </li>
          <li className="ds-text-2">
            <Link href="/ontology/automations" className="underline ds-text">Ask the model</Link> a question
            in plain English. Watch it gather evidence, then read its cited answer.
          </li>
          <li className="ds-text-2">
            Confirm one proposed action yourself — nothing runs until you do. Notice the preview first.
          </li>
          <li className="ds-text-2">
            <Link href="/ontology/inbox" className="underline ds-text">Open the Inbox</Link> to see how
            approvals wait, and <Link href="/ontology/audit" className="underline ds-text">Audit</Link> to
            see the decision you just made, recorded.
          </li>
          <li className="ds-text-2">
            <Link href="/ontology" className="underline ds-text">Open the model map</Link> on the Schema
            page — click any box to see how your business connects.
          </li>
        </ol>
      </section>

      <section aria-label="Three jobs">
        <h2 className="font-medium ds-text">Three jobs, three areas</h2>
        <ul className="mt-2 space-y-2">
          <li className="ds-text-2">
            <span className="ds-text">Understand</span> (Twin, Explore, Schema) — what is true right now?
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Do</span> (Actions, Inbox) — what should change, with whose permission?
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Decide</span> (Automations, Scenarios, Audit, Ops) — was it thought
            through, simulated, and recorded?
          </li>
        </ul>
      </section>

      <section aria-label="AI rules">
        <h2 className="font-medium ds-text">What the AI can and cannot do</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 ds-text-2">
          <li>Answer from your live data only, citing the exact objects it used — never from memory.</li>
          <li>Run the same deterministic math your dashboards use for coverage, reorder, and risk.</li>
          <li>Propose actions with a preview. It cannot execute, approve, or skip confirmation.</li>
          <li>See only objects your role may see; hidden rows stay hidden from it too.</li>
        </ul>
      </section>

      <section aria-label="Glossary">
        <h2 className="font-medium ds-text">Glossary</h2>
        <dl className="mt-2 space-y-2">
          {GLOSSARY.map(([term, def]) => (
            <div key={term} className="rounded ds-panel p-3">
              <dt className="font-medium ds-text">{term}</dt>
              <dd className="mt-0.5 ds-text-2">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Questions">
        <h2 className="font-medium ds-text">Questions newcomers ask</h2>
        <div className="mt-2 space-y-3">
          {FAQS.map(([q, a]) => (
            <div key={q}>
              <p className="font-medium ds-text">{q}</p>
              <p className="mt-0.5 ds-text-2">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
