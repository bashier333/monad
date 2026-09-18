import Link from "next/link";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-sm">
      <h1 className="text-xl font-bold">Support</h1>
      <p>
        Talk to a human:{" "}
        <a href="mailto:support@example.com" className="underline">
          support@example.com
        </a>{" "}
        (replace with the shared inbox before pilot 1).
      </p>
      <p>Beta SLA: acknowledge within 4 hours, workaround within 24 hours.</p>
      <p>
        Wrong figure? Read <Link href="/help" className="underline">how corrections work</Link> first —
        most “bugs” are data or mapping issues you can fix yourself in one click.
      </p>
    </main>
  );
}
