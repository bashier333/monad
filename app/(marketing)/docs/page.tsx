import Link from "next/link";

const DOCS = [
  { href: "/help/ontology", title: "Ontology guide", desc: "Your business model in plain English: tour, glossary, FAQ." },
  { href: "/help", title: "User guides", desc: "Upload, read answers, correct costs." },
  { href: "/pricing", title: "Pricing", desc: "Tiers and billing." },
  { href: "/changelog", title: "Changelog", desc: "Every release in plain English." },
  { href: "/known-issues", title: "Known issues", desc: "Limitations, updated weekly." },
  { href: "/support", title: "Support", desc: "Talk to a human." },
  { href: "/status", title: "Status", desc: "Live system status." },
];

const SUBPROCESSORS = ["Hosting + Postgres", "Object storage", "Resend (email)", "Stripe (billing)", "PostHog (analytics)", "Sentry (errors)", "Google (OAuth)"];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-8 text-sm">
      <h1 className="text-xl font-bold">Docs</h1>
      {DOCS.map((d) => (
        <section key={d.href} className="rounded border p-3">
          <Link href={d.href} className="font-medium underline">
            {d.title}
          </Link>
          <p className="text-gray-600">{d.desc}</p>
        </section>
      ))}
      <p className="text-gray-600">
        TMS-specific upload guides (McLeod, TMW, Prophesy, AscendTMS) live with the team and
        expand with every pilot — ask support for yours.
      </p>
      <section className="rounded border p-3">
        <h2 className="font-medium">Subprocessors</h2>
        <ul className="list-disc pl-5 text-gray-600">
          {SUBPROCESSORS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-1 text-gray-600">Regions pinned US; DPAs signed before pilot data flows.</p>
      </section>
    </main>
  );
}
