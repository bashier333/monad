import Link from "next/link";

// Shared marketing chrome: logo home, product destinations, the account
// path (Dashboard for members, Sign in + Sign up for everyone else), and
// the installer CTA. Every public page renders this so visitors never
// strand without a way back — desktop and mobile alike. Translucent panel
// like the app nav: one language.
const NAV_LINKS = [
  ["Ontology", "/platforms/ontology"],
  ["Pricing", "/pricing"],
  ["Dashboard", "/workspace"],
  ["Download", "/download"],
] as const;

export function MarketingHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: "var(--hairline)", background: "color-mix(in srgb, var(--panel) 88%, transparent)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight ds-text">
          <span aria-hidden className="inline-block h-5 w-5 rounded-[5px]" style={{ background: "var(--accent)" }} />
          Monad
        </Link>
        <nav className="hidden items-center gap-6 text-[15px] md:flex" aria-label="Page">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="transition-opacity ds-text-2 hover:opacity-80">
              {label}
            </Link>
          ))}
          <Link
            href="/signin"
            className="ds-state rounded-md border px-4 py-2 font-semibold ds-text"
            style={{ borderColor: "var(--hairline)" }}
          >
            Sign in
          </Link>
          <Link
            href="/signin?callbackUrl=%2Fupload"
            className="rounded-md px-4 py-2 font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Sign up
          </Link>
        </nav>
        <details className="relative md:hidden">
          <summary className="ds-state cursor-pointer list-none rounded-md border px-3 py-2 text-sm ds-text" style={{ borderColor: "var(--hairline)" }}>
            Menu
          </summary>
          <div
            className="absolute right-0 z-40 mt-1 flex min-w-48 flex-col rounded-lg p-1 ds-panel"
            style={{ borderColor: "var(--hairline)", background: "var(--panel)" }}
          >
            {NAV_LINKS.map(([label, href]) => (
              <Link key={href} href={href} className="ds-state rounded-md px-2 py-1.5 ds-text">
                {label}
              </Link>
            ))}
            <Link href="/signin" className="ds-state rounded-md px-2 py-1.5 ds-text">
              Sign in
            </Link>
            <Link href="/signin?callbackUrl=%2Fupload" className="ds-state rounded-md px-2 py-1.5 font-medium ds-text">
              Sign up
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--hairline)" }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm ds-text-2 md:px-8">
        <p>Monad</p>
        <p className="flex flex-wrap gap-5">
          <Link href="/download" className="transition-opacity hover:opacity-80">
            Download
          </Link>
          <Link href="/platforms/ontology" className="transition-opacity hover:opacity-80">
            Ontology
          </Link>
          <Link href="/status" className="transition-opacity hover:opacity-80">
            Status
          </Link>
          <Link href="/changelog" className="transition-opacity hover:opacity-80">
            Changelog
          </Link>
        </p>
      </div>
    </footer>
  );
}
