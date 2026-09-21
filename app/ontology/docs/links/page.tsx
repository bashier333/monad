import Link from "next/link";

// Doc 2 of 3 for Ontology Studio: links. Plain copy only:
// short sentences, concrete verbs, no em dashes, no filler adjectives.
export const metadata = { title: "Links - Ontology docs" };

export default function LinksDocPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 text-sm md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline ds-text">
          Ontology Studio
        </Link>{" "}
        <span className="ds-text-2">/ Docs / Links</span>
      </p>
      <div>
        <h1 className="text-xl font-semibold tracking-tight ds-text">Links: how things connect</h1>
        <p className="mt-2 ds-text-2">
          A link names one relationship between two types. A lot sits in a warehouse. A shipment heads
          to a customer. Without links you have lists. With links you have a model you can walk.
        </p>
      </div>

      <section aria-label="Reading the links list">
        <h2 className="text-[15px] font-semibold ds-text">Reading the Links list</h2>
        <p className="mt-1 ds-text-2">
          Each row shows the key, the source type, the target type, and the cardinality. Cardinality
          says how many may sit on each side. One warehouse holds many lots. One shipment has one
          destination. The model enforces this on every write, so bad joins cannot sneak in through an import.
        </p>
      </section>

      <section aria-label="What links unlock">
        <h2 className="text-[15px] font-semibold ds-text">What links unlock</h2>
        <ul className="mt-2 space-y-2">
          <li className="ds-text-2">
            <Link href="/ontology/explore" className="underline ds-text">Explore</Link> walks links from
            any object. Start at a delayed shipment and follow it to the plant, the lots, and the
            customers waiting on them.
          </li>
          <li className="ds-text-2">
            The <Link href="/ontology/twin" className="underline ds-text">Twin</Link> reads links to
            find exposure. A late shipment matters because of the customers linked past it.
          </li>
          <li className="ds-text-2">
            Automations cite linked objects as evidence, so an answer shows the chain it walked, not
            just the number it printed.
          </li>
        </ul>
      </section>

      <section aria-label="Keeping links honest">
        <h2 className="text-[15px] font-semibold ds-text">Keeping links honest</h2>
        <p className="mt-1 ds-text-2">
          Links come from your imports matching on identity fields. When a row names a warehouse the
          model has never seen, the row is quarantined with the reason attached. Fix the name or add
          the warehouse, then re-run. The link appears only when both ends exist.
        </p>
      </section>

      <p className="text-sm ds-text-2">
        Back to <Link href="/ontology/docs/types" className="underline ds-text">Types</Link>. On to{" "}
        <Link href="/ontology/docs/actions" className="underline ds-text">Actions</Link>.
      </p>
    </main>
  );
}
