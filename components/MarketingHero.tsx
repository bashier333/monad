import type { ReactNode } from "react";

// Shared marketing hero: monochrome translucent band over the video
// backdrop, grotesk display headline (via the .mkt group rule), optional
// sub-copy and CTA row. One voice for every public page.
export default function MarketingHero({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <section className="bg-white/70 dark:bg-black/60">
      <div className="mx-auto max-w-4xl px-6 py-14 text-center md:py-20">
        <h1 className="mx-auto max-w-[22ch] text-balance text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">
          {title}
        </h1>
        {sub ? (
          <p className="mx-auto mt-4 max-w-[54ch] text-[17px] leading-relaxed text-black/70 dark:text-white/70">
            {sub}
          </p>
        ) : null}
        {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
      </div>
    </section>
  );
}
