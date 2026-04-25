/**
 * PayWatch Motion System — Presets
 * ALL physical interactions use springs (not ease curves).
 * 
 * "If you're using cubic-bezier, you're already wrong for iOS."
 * iOS uses springs for everything because real objects move with springs.
 * 
 * Exceptions:
 * - Number counters: use ease-out (numbers should "land", not bounce)
 * - Progress bars: use linear (clock time is linear)
 * - Skeleton → content: use 150-250ms fade
 */

import { spring } from './tokens';

export const presets = {
  // ─── Tap / Press ──────────────────────────────────────
  press: {
    whileTap: { scale: 0.96 },
    transition: spring.press,
  },

  pressSubtle: {
    whileTap: { scale: 0.98 },
    transition: spring.press,
  },

  // ─── Page Push (iOS Navigation) ───────────────────────
  // Previous page parallaxes at 30% speed + dims. New page springs in.
  pagePush: {
    initial: { x: '100%' },
    animate: {
      x: 0,
      transition: spring.nav,
    },
    exit: {
      x: '-30%',
      opacity: 0.5,
      transition: spring.nav,
    },
  },

  // ─── Page Pop (Back navigation) ───────────────────────
  pagePop: {
    initial: { x: '-30%', opacity: 0.5 },
    animate: {
      x: 0,
      opacity: 1,
      transition: spring.nav,
    },
    exit: {
      x: '100%',
      transition: spring.nav,
    },
  },

  // ─── Tab Switch (Bottom nav) ──────────────────────────
  tabFade: {
    initial: { opacity: 0, scale: 0.98 },
    animate: { opacity: 1, scale: 1, transition: spring.snap },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  },

  // ─── Sheet / Drawer ───────────────────────────────────
  sheet: {
    initial: { y: '100%' },
    animate: { y: 0, transition: spring.sheet },
    exit: { y: '100%', transition: spring.sheet },
  },

  // ─── Background when sheet is open ────────────────────
  sheetBackground: {
    active: { scale: 0.96, borderRadius: 12, transition: spring.nav },
    inactive: { scale: 1, borderRadius: 0, transition: spring.nav },
  },

  // ─── List Items (staggered entrance) ──────────────────
  listContainer: {
    hidden: {},
    show: { transition: { staggerChildren: 0.04 } },
  },

  listItem: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: spring.layout },
  },

  // ─── Fade In (skeleton → content) ─────────────────────
  // Exception: NOT a spring. Use timed fade for data swap.
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2 } },
  },

  // ─── Hero Number Change ───────────────────────────────
  // Exception: ease-out, not spring. Numbers should "land", not bounce.
  valueChange: {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } },
  },

  // ─── Reaction / Like (bounce) ─────────────────────────
  reaction: {
    whileTap: { scale: 0.9 },
    transition: spring.bounce,
  },
} as const;
