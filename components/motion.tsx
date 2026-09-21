"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// House motion: critically damped springs (damping 1.0, no overshoot) for
// entrances and panels. Bounce is reserved for momentum-driven gestures,
// of which this app currently has none. Reduced-motion users get an instant
// settle: opacity cross-fade at most, never a slide.
export const ENTER_SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;

export default function SpringIn({
  children,
  className = "",
  delay = 0,
  y = 22,
  scaleFrom,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scaleFrom?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      data-motion="in"
      initial={{ opacity: 0, y, ...(scaleFrom !== undefined ? { scale: scaleFrom } : {}) }}
      whileInView={{ opacity: 1, y: 0, ...(scaleFrom !== undefined ? { scale: 1 } : {}) }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ...ENTER_SPRING, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
