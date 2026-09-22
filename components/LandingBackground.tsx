"use client";

import Image from "next/image";

// Fixed full-page video background for the landing page. Respects
// reduced-motion (still image instead of autoplay) and never renders
// audio, controls, or tracking — pure backdrop, hidden from assistive tech.
export default function LandingBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <Image
        src="/images/monad-skyline.jpg"
        alt=""
        fill
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <video
        className="landing-bg-video absolute inset-0 h-full w-full object-cover"
        style={{ filter: "saturate(1.4) contrast(1.05) brightness(1.03)" }}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      >
        <source src="/videos/abstract-lines.mp4" type="video/mp4" />
      </video>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .landing-bg-video { display: none; }
        }
      `}</style>
    </div>
  );
}
