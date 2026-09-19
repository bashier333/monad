import Link from "next/link";

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-sm">
      <h1 className="text-xl font-bold">Trust center</h1>
      <p className="text-gray-700">
        Decision memory only works if you trust it with your numbers. Our commitments:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-gray-700">
        <li>Your data is namespaced per organization — staging tenancy checks prove it before every release.</li>
        <li>Export everything, anytime (`/org/data`) — we never hold data hostage.</li>
        <li>Every dollar links to its source row; every rule states itself in plain English.</li>
        <li>Corrections are reversible; briefs carry their full trail.</li>
        <li>Incidents are disclosed in the changelog, honestly.</li>
      </ul>
      <section className="rounded border p-4">
        <h2 className="font-medium">Security reports</h2>
        <p className="mt-1 text-gray-700">
          Found a vulnerability? Email security@example.test with details (PGP on request).
          We acknowledge within 2 business days and fix criticals within 7.
        </p>
      </section>
      <section className="rounded border p-4">
        <h2 className="font-medium">Subprocessors</h2>
        <p className="mt-1 text-gray-700">
          Hosting (database + app), Resend (email), Stripe (billing), PostHog (product analytics, opt-out friendly).
          Changes announced in the changelog with 30 days notice.
        </p>
      </section>
      <p>
        <Link href="/status" className="underline">Status</Link> ·{" "}
        <Link href="/changelog" className="underline">Changelog</Link> ·{" "}
        <Link href="/known-issues" className="underline">Known issues</Link>
      </p>
    </main>
  );
}
