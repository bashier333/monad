import Link from "next/link";

// Doc 3 of 3 for Ontology Studio: actions. Plain copy only:
// short sentences, concrete verbs, no em dashes, no filler adjectives.
export const metadata = { title: "Actions - Ontology docs" };

export default function ActionsDocPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 text-sm md:p-8">
      <p className="text-sm">
        <Link href="/ontology" className="underline ds-text">
          Ontology Studio
        </Link>{" "}
        <span className="ds-text-2">/ Docs / Actions</span>
      </p>
      <div>
        <h1 className="text-xl font-semibold tracking-tight ds-text">Actions: the only way to change things</h1>
        <p className="mt-2 ds-text-2">
          Reading is free. Changing goes through an action, every time. An action names what may change,
          who may run it, and what must be true first. No action, no write. That is the whole rule.
        </p>
      </div>

      <section aria-label="Reading the actions list">
        <h2 className="text-[15px] font-semibold ds-text">Reading the Actions list</h2>
        <p className="mt-1 ds-text-2">
          Each row shows the label, the key, the target type, and the approval policy. The policy says
          whether it runs on confirm, or waits for a second person in the Inbox. Sensitive changes wait.
          Routine ones do not.
        </p>
      </section>

      <section aria-label="The safe path of one action">
        <h2 className="text-[15px] font-semibold ds-text">The safe path of one action</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li className="ds-text-2">
            <span className="ds-text">Preview.</span> The console shows each field change as
            before and after, before anything runs.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Confirm.</span> You confirm explicitly. Wide blast radius actions
            ask you to type the target key, so a slip cannot pass on muscle memory.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Approve, if required.</span> The request waits in the Inbox with
            its preview attached until someone with authority decides.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Execute once.</span> Every run carries an idempotency key built
            from the action, the object, and the inputs. Retries replay the original receipt instead of
            writing twice.
          </li>
          <li className="ds-text-2">
            <span className="ds-text">Audit.</span> The run lands in the hash-chained trail with actor,
            inputs, and before and after values.
          </li>
        </ol>
      </section>

      <section aria-label="Where actions run">
        <h2 className="text-[15px] font-semibold ds-text">Where actions run</h2>
        <ul className="mt-2 space-y-2">
          <li className="ds-text-2">
            <Link href="/ontology/actions" className="underline ds-text">Actions console</Link>, by hand,
            with preview and confirm in front of you.
          </li>
          <li className="ds-text-2">
            <Link href="/ontology/automations" className="underline ds-text">Automations</Link>, proposed
            by the AI and confirmed by you. It cannot skip your confirm.
          </li>
          <li className="ds-text-2">
            <Link href="/ontology/inbox" className="underline ds-text">Inbox</Link>, where approvals wait
            with their previews attached.
          </li>
        </ul>
      </section>

      <p className="text-sm ds-text-2">
        Back to <Link href="/ontology/docs/types" className="underline ds-text">Types</Link> and{" "}
        <Link href="/ontology/docs/links" className="underline ds-text">Links</Link>.
      </p>
    </main>
  );
}
