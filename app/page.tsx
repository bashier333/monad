import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import Reveal from "./reveal";
import { APP_VERSION } from "@/lib/core/version";

// World: light manifesto instrument. Stone-50 ground, hairline borders,
// tabular numerals, one signal emerald. Surfaces 16px, controls full-pill.
// Deliberately light-only (colorScheme pinned): dark mode never restyles
// the landing — the app behind it is the themed surface.
const sans = Space_Grotesk({ subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Monad - National AI Infrastructure",
  description:
    "National AI infrastructure built for every operational strategic execution. Our platforms drive instantaneous, AI-enabled operational decisions.",
};

export default function MonadPage() {
  return (
    <main className={`${sans.className} bg-stone-50 text-stone-900`} style={{ colorScheme: "light" }}>
      <style>{`
        ::selection { background: #047857; color: #ffffff; }
        :focus-visible { outline: 2px solid #047857; outline-offset: 3px; border-radius: 6px; }
        .rv { opacity: 0; transform: translateY(26px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
        .rv.in { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) {
          .rv { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
      <noscript>
        <style>{`.rv { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>

      <header className="border-b border-stone-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/" className="text-[17px] font-bold tracking-tight">
            Monad
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] text-stone-600 md:flex" aria-label="Page">
            <Link href="/platforms/ontology" className="transition-colors hover:text-stone-900">
              Ontology
            </Link>
            <Link href="/model" className="transition-colors hover:text-stone-900">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 text-center min-h-[100dvh] md:px-8 md:pt-24">
          <Reveal>
            <h1 className="mx-auto max-w-[24ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              National AI Infrastructure Built for Every Operational Strategic Execution
            </h1>
            <p className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-relaxed text-stone-600">
              One live model of the business. Fragmented records become linked objects that people and agents read
              the same way.
            </p>
          </Reveal>
          <Reveal delay={140} className="mx-auto mt-12 max-w-5xl">
            <Image
              src="/images/monad-skyline.jpg"
              width={1920}
              height={1280}
              alt="City skyline at dusk from above"
              priority
              sizes="(max-width: 768px) 100vw, 1024px"
              className="w-full rounded-2xl border border-stone-200 object-cover"
            />
          </Reveal>
        </div>
      </section>

      <section id="software" className="border-t border-stone-200">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Our software</h2>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-stone-600">
              Our platforms drive instantaneous, AI-enabled operational decisions across vital Western public and
              private sector institutions, linking industrial supply chains directly to tactical frontline units.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <Link
              href="/platforms/ontology"
              className="group block rounded-2xl border border-stone-200 bg-white p-6 transition-colors hover:border-stone-400 md:p-8"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-xl font-bold">Ontology</p>
                <span
                  aria-hidden="true"
                  className="text-stone-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-emerald-700"
                >
                  &rarr;
                </span>
              </div>
              <p className="mt-2 max-w-[58ch] text-[15px] leading-relaxed text-stone-600">
                The foundational hub driving joint human and machine decision-making.
              </p>
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-stone-500 md:px-8">
          <p>Monad v{APP_VERSION}. One model. One line.</p>
          <p className="flex gap-5">
            <Link href="/download" className="transition-colors hover:text-stone-900">
              Download
            </Link>
            <Link href="/platforms/ontology" className="transition-colors hover:text-stone-900">
              Ontology
            </Link>
            <Link href="/model" className="transition-colors hover:text-stone-900">
              Dashboard
            </Link>
            <Link href="/changelog" className="transition-colors hover:text-stone-900">
              Changelog
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
