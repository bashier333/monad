import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import Reveal from "./reveal";

// Landing: enterprise-clean. Split hero (copy left, asset right), one idea
// per section, single blue accent, no version stamps, no em-dashes.
const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Monad - National AI Infrastructure",
  description:
    "One live model of the business. Fragmented records become linked objects that people and agents read the same way.",
};

export default function MonadPage() {
  return (
    <main className={`${sans.className}`} style={{ background: "var(--ground)", color: "var(--fg)" }}>
      <style>{`
        ::selection { background: var(--accent); color: #ffffff; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
      `}</style>

      <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: "var(--hairline)", background: "color-mix(in srgb, var(--panel) 88%, transparent)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
            <span aria-hidden className="inline-block h-5 w-5 rounded-[5px]" style={{ background: "var(--accent)" }} />
            Monad
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] md:flex" aria-label="Page">
            <Link href="/platforms/ontology" className="transition-colors ds-text-2 hover:opacity-80">
              Ontology
            </Link>
            <Link href="/model" className="transition-colors ds-text-2 hover:opacity-80">
              Model
            </Link>
            <Link href="/pricing" className="transition-colors ds-text-2 hover:opacity-80">
              Pricing
            </Link>
            <Link
              href="/download"
              className="rounded-md px-4 py-2 font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              Download
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:px-8 md:pb-24 md:pt-20">
          <Reveal>
            <h1 className="max-w-[20ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              One live model of the business
            </h1>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed ds-text-2">
              Fragmented records become linked objects that people and agents read the same way.
            </p>
            <p className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="rounded-md px-5 py-2.5 text-[15px] font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                See the live demo
              </Link>
              <Link
                href="/docs"
                className="rounded-md border px-5 py-2.5 text-[15px] font-semibold ds-text"
                style={{ borderColor: "var(--hairline)" }}
              >
                Read the docs
              </Link>
            </p>
          </Reveal>
          <Reveal delay={140}>
            <Image
              src="/images/monad-skyline.jpg"
              width={1920}
              height={1280}
              alt="City skyline at dusk from above"
              priority
              sizes="(max-width: 768px) 100vw, 640px"
              className="w-full rounded-[10px] border object-cover"
              style={{ borderColor: "var(--hairline)" }}
            />
          </Reveal>
        </div>
      </section>

      <section id="software" className="border-t" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="max-w-[24ch] text-3xl font-bold tracking-tight md:text-4xl">
              Decisions, with receipts
            </h2>
            <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed ds-text-2">
              Every answer links to its source rows. Every correction becomes a rule. Every action is approved and audited.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            <Reveal delay={80} className="md:col-span-3">
              <Link
                href="/platforms/ontology"
                className="ds-state group block h-full p-6 md:p-8"
                style={{ background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 10 }}
              >
                <p className="text-xl font-bold">Ontology</p>
                <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed ds-text-2">
                  Objects, links, and governed actions in one model. Humans and agents work from the same world.
                </p>
                <p className="mt-4 text-[15px] font-semibold" style={{ color: "var(--accent)" }}>
                  <span aria-hidden className="transition-all duration-200 group-hover:ml-1">→</span> Explore the ontology
                </p>
              </Link>
            </Reveal>
            <Reveal delay={160} className="md:col-span-2">
              <Link
                href="/model"
                className="ds-state group block h-full p-6 md:p-8"
                style={{ background: "var(--panel-2)", border: "1px solid var(--hairline)", borderRadius: 10 }}
              >
                <p className="text-xl font-bold">Model</p>
                <p className="mt-2 text-[15px] leading-relaxed ds-text-2">
                  Live source status and the checks running on your data right now.
                </p>
                <p className="mt-4 text-[15px] font-semibold" style={{ color: "var(--accent)" }}>
                  <span aria-hidden className="transition-all duration-200 group-hover:ml-1">→</span> Open the model
                </p>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="border-t" style={{ borderColor: "var(--hairline)" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm ds-text-2 md:px-8">
          <p>Monad. One model. One line.</p>
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
    </main>
  );
}
