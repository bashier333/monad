import Link from "next/link";
import HelpSearch from "@/components/HelpSearch";

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8 text-sm">
      <h1 className="text-xl font-bold">Help</h1>
      <HelpSearch>
      <section id="upload" className="rounded border p-4">
        <h2 className="font-medium">1. Upload an export</h2>
        <div className="mt-1 space-y-1 text-gray-700">
          <p>
            Go to <Link href="/upload" className="underline">Upload</Link>, pick the source type, and
            submit a .csv or .xlsx (max 50MB).
          </p>
          <p>TMS/dispatch export needs at minimum: a load ID, a date, and revenue per load.</p>
          <p>Fuel CSVs need: truck, date, amount. Broker statements need: load reference + fee.</p>
          <p>
            After upload, confirm the detected column mapping on the import page — your correction
            becomes the default next time. Quarantined rows list the exact reason; fix the file and
            re-upload.
          </p>
        </div>
      </section>
      <section id="read" className="rounded border p-4">
        <h2 className="font-medium">2. Read an answer</h2>
        <div className="mt-1 space-y-1 text-gray-700">
          <p>
            <Link href="/answers" className="underline">Answers</Link> shows every lane&apos;s margin for the
            week, worst first. Red margins lose money.
          </p>
          <p>
            Click a lane to see its loads, then expand any load to see every cost line and the exact
            source file + row behind it. The “How this answer was built” box lists every rule applied —
            nothing is a black box.
          </p>
          <p>Type questions like “which lanes lost money last week?” in the Ask box.</p>
        </div>
      </section>
      <section id="correct" className="rounded border p-4">
        <h2 className="font-medium">3. Correct a cost</h2>
        <div className="mt-1 space-y-1 text-gray-700">
          <p>
            Hit “flag” on any cost line, say why, and where the cost belongs (a load number or EXCLUDE).
            An owner applies it from <Link href="/corrections" className="underline">the queue</Link> —
            the answer updates immediately and the full history stays pinned to the figure.
          </p>
          <p>
            Recurring fixes become <Link href="/rules" className="underline">standing rules</Link> (e.g.
            “detention where driver = Deshawn always goes to the shipper”). Preview shows exactly which
            loads a rule would touch before you save it.
          </p>
        </div>
      </section>
      </HelpSearch>
    </main>
  );
}
