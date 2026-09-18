import Link from "next/link";
import Bell from "@/components/Bell";

const LINKS = [
  ["Answers", "/answers"],
  ["Upload", "/upload"],
  ["Briefs", "/briefs"],
  ["Corrections", "/corrections"],
  ["Rules", "/rules"],
  ["Pilots", "/pilots"],
  ["Settings", "/settings"],
  ["Help", "/help"],
] as const;

export default function TopNav() {
  return (
    <nav className="border-b" aria-label="Primary">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm md:px-8">
        <Link href="/" className="font-bold">
          Decision Layer
        </Link>
        {LINKS.map(([label, href]) => (
          <Link key={href} href={href} className="text-gray-600 hover:underline">
            {label}
          </Link>
        ))}
        <span className="ml-auto">
          <Bell />
        </span>
      </div>
    </nav>
  );
}
