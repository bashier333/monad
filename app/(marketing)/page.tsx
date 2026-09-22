import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import HeroFade from "@/components/HeroFade";
import Reveal from "../reveal";

// Landing: monochrome hero (white in light, black in dark) that the rest
// of the page merges over on scroll, one idea per section. Video backdrop,
// display font, and veil come from the marketing group layout.

export const metadata: Metadata = {
  title: "Monad - Autonomous AI Infrastructure",
  description:
    "Autonomous AI infrastructure for mission-critical operations. Our software powers real-time, AI-driven decisions from the factory floor to the front lines.",
};

export default function MonadPage() {
  return (
    <div>
      <style>{`
        ::selection { background: var(--accent); color: #ffffff; }
        :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
      `}</style>

      <section className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden bg-white/70 text-black dark:bg-black/60 dark:text-white">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-14 md:grid-cols-2 md:px-8 md:pb-24 md:pt-20">
          <HeroFade>
            <h1 className="max-w-[20ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Autonomous AI Infrastructure for Mission-Critical Operations
            </h1>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-relaxed text-black/70 dark:text-white/70">
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
                className="rounded-md border border-black/20 px-5 py-2.5 text-[15px] font-semibold dark:border-white/25"
              >
                Read the docs
              </Link>
            </p>
          </HeroFade>
          <Reveal delay={140}>
            <Image
              src="/images/monad-skyline.jpg"
              width={1920}
              height={1280}
              alt="City skyline at dusk from above"
              priority
              sizes="(max-width: 768px) 100vw, 640px"
              className="w-full rounded-[10px] border border-black/15 object-cover dark:border-white/15"
            />
          </Reveal>
        </div>
      </section>

      <div
        className="relative z-10"
        style={{ background: "color-mix(in srgb, var(--ground) 62%, transparent)" }}
      >
        <section id="software">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Our Software
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <Reveal delay={80}>
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
              <Reveal delay={140}>
                <Link
                  href="/platforms/foundry"
                  className="ds-state group block h-full p-6 md:p-8"
                  style={{ background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 10 }}
                >
                  <p className="text-xl font-bold">Foundry</p>
                  <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed ds-text-2">
                    Connectors that pull CSV, REST, and live sources straight into ontology types — validated, freshness-badged, and audited.
                  </p>
                  <p className="mt-4 text-[15px] font-semibold" style={{ color: "var(--accent)" }}>
                    <span aria-hidden className="transition-all duration-200 group-hover:ml-1">→</span> Use in Ontology
                  </p>
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
