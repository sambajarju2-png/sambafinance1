'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Animated number counter for hero stats (total debt, monthly cost, etc.)
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
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) =>
    `${prefix}${Math.round(v).toLocaleString('nl-NL')}`
  );

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94], // ease-out — number "lands"
    });
    return controls.stop;
  }, [value, duration, motionValue]);

  return <motion.span>{rounded}</motion.span>;
}
