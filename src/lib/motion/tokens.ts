/**
 * PayWatch Motion System — Tokens
 * Single source of truth for ALL animation values.
 * 
 * Rules:
 * - Never use raw duration/ease values in components
 * - Always import from here
 * - iOS uses springs, not CSS ease-in-out
 */

export const duration = {
  instant: 0.08,   // tap feedback
  fast: 0.16,      // fade, micro-interactions
  base: 0.24,      // content transitions
  slow: 0.32,      // page push/pop (UIKit standard)
  slower: 0.45,    // sheets, drawers
} as const;

export const ease = {
  /** iOS UIKit standard — decelerating, feels physical */
  ios: [0.32, 0.72, 0, 1] as const,
  /** Subtle fade — smooth entrance */
  fade: [0.4, 0, 0.2, 1] as const,
  /** Entrance with slight overshoot feel */
  entrance: [0.2, 0.8, 0.2, 1] as const,
  /** Quick exit */
  exit: [0.4, 0, 1, 1] as const,
};

export const spring = {
  /** Button/card press — snappy, no bounce */
  press: { type: 'spring' as const, stiffness: 500, damping: 30 },
  /** Sheet/drawer — heavy, fluid */
  sheet: { type: 'spring' as const, stiffness: 400, damping: 35 },
  /** Playful bounce — reactions, success states */
  bounce: { type: 'spring' as const, stiffness: 300, damping: 20 },
  /** Toggle switch — fast snap */
  toggle: { type: 'spring' as const, stiffness: 500, damping: 30 },
};

/** Swipe-back gesture thresholds */
export const gesture = {
  /** Minimum drag distance to trigger back navigation */
  backThreshold: 120,
  /** Minimum velocity to trigger back navigation */
  backVelocity: 500,
  /** Pull-to-refresh trigger distance */
  pullThreshold: 70,
  /** Drag elasticity (0 = rigid, 1 = loose) */
  elasticity: 0.12,
};
