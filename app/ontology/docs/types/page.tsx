import Link from "next/link";

// Doc 1 of 3 for Ontology Studio: object types. Plain copy only:
// short sentences, concrete verbs, no em dashes, no filler adjectives.
export const metadata = { title: "Types - Ontology docs" };

export default function TypesDocPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 text-sm md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline ds-text">
          Ontology Studio
        </Link>{" "}
        <span className="ds-text-2">/ Docs / Types</span>
      </p>
      <div>
        <h1 className="text-xl font-semibold tracking-tight ds-text">Types: the nouns of your business</h1>
        <p className="mt-2 ds-text-2">
          A type names one kind of thing you track. Lots, shipments, plants, customers. Each type lists
          its properties, and every object of that type carries values for those properties.
        </p>
      </div>

      <section aria-label="Reading the types list">
        <h2 className="text-[15px] font-semibold ds-text">Reading the Types list</h2>
        <p className="mt-1 ds-text-2">
          Each row shows the label, the key, the version, the property count, the object count, and the
          status. The key is the stable name the API and the automations use. The version rises every
          time the shape changes, so you can tell whether two exports describe the same model.
        </p>
      </section>

      <section aria-label="Property flags">
        <h2 className="text-[15px] font-semibold ds-text">What the property flags mean</h2>
        <ul className="mt-2 space-y-2">
          <li className="ds-text-2">
            <span className="ds-text">Required.</span> Every object must carry a value. Imports missing
            one are quarantined, not guessed.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Unique.</span> No two objects share it. This is how the model
            matches incoming rows to existing objects instead of duplicating them.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Indexed.</span> Lookups on it stay fast as the object count grows.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Immutable.</span> Set once at creation. Later writes are rejected,
            so identity fields cannot drift.
          </li>
        </ul>
      </section>

      <section aria-label="Where types come from">
        <h2 className="text-[15px] font-semibold ds-text">Where types come from</h2>
        <p className="mt-1 ds-text-2">
          Seeding a pack creates its types for you. Manufacturing, freight, and agency packs each ship
          the types, links, and actions that business needs. Click any type to open its objects,
          properties, and the actions that may touch them.
        </p>
      </section>

      <p className="text-sm ds-text-2">
        Next: <Link href="/ontology/docs/links" className="underline ds-text">Links</Link> connect types
        together. <Link href="/ontology/docs/actions" className="underline ds-text">Actions</Link> change them.
      </p>
    </main>
  );
}
