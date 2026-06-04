'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated number counter for hero stats (total debt, monthly cost, etc.)
 *
 * Pure requestAnimationFrame implementation — intentionally NOT Framer Motion.
 * This keeps the animation library off the dashboard's critical path (it was
 * the single biggest non-essential dependency loaded on first paint).
 *
 * Uses ease-out, NOT spring — numbers should "land" on their target,
 * not overshoot. Springs on numbers feel uncertain in a financial app.
 */
export function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = '€',
}: {
  value: number;
  duration?: number;
  prefix?: string;
}) {
  const [display, setDisplay] = useState(0);
  // Animate from the previously-shown value (matches Framer's behaviour on
  // value change), starting at 0 on first mount.
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const durationMs = Math.max(duration, 0) * 1000;

    // Respect users who prefer reduced motion — snap straight to the value.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (durationMs === 0 || prefersReduced || from === to) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    // easeOutCubic — fast then settles, "lands" on the target without overshoot.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      setDisplay(from + (to - from) * ease(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span>{`${prefix}${Math.round(display).toLocaleString('nl-NL')}`}</span>;
}
