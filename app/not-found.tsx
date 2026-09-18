import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-8 text-center text-sm">
      <h1 className="text-xl font-bold">Nothing here.</h1>
      <p className="text-gray-600">That page doesn&apos;t exist or you can&apos;t see it.</p>
      <div className="flex justify-center gap-3">
        <Link href="/answers" className="underline">Answers</Link>
        <Link href="/upload" className="underline">Upload</Link>
        <Link href="/help" className="underline">Help</Link>
      </div>
    </main>
  );
}
