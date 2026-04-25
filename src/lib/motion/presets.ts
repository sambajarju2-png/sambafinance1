/**
 * PayWatch Motion System — Presets
 * Semantic animation configurations.
 * 
 * Usage:
 *   <motion.div {...presets.press} />
 *   <motion.div {...presets.pagePush} />
 */

import { duration, ease } from './tokens';

export const presets = {
  // ─── Tap / Press ──────────────────────────────────────
  press: {
    whileTap: { scale: 0.96 },
    transition: { duration: duration.instant },
  },

  pressSubtle: {
    whileTap: { scale: 0.98 },
    transition: { duration: duration.instant },
  },

  // ─── Page Push (iOS Navigation) ───────────────────────
  pagePush: {
    initial: { x: '100%', opacity: 1 },
    animate: {
      x: 0,
      opacity: 1,
      transition: { duration: duration.slow, ease: ease.ios },
    },
    exit: {
      x: '-30%',
      opacity: 0.8,
      scale: 0.98,
      transition: { duration: duration.slow, ease: ease.ios },
    },
  },

  // ─── Page Pop (Back navigation) ───────────────────────
  pagePop: {
    initial: { x: '-30%', opacity: 0.8, scale: 0.98 },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: { duration: duration.slow, ease: ease.ios },
    },
    exit: {
      x: '100%',
      opacity: 1,
      transition: { duration: duration.slow, ease: ease.ios },
    },
  },

  // ─── Tab Switch (Bottom nav) ──────────────────────────
  tabFade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.12 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  },

  // ─── Sheet / Drawer ───────────────────────────────────
  sheet: {
    initial: { y: '100%' },
    animate: {
      y: 0,
      transition: { duration: duration.slower, ease: ease.ios },
    },
    exit: {
      y: '100%',
      transition: { duration: duration.base, ease: ease.exit },
    },
  },

  // ─── Background when sheet is open ────────────────────
  sheetBackground: {
    active: {
      scale: 0.96,
      borderRadius: 12,
      transition: { duration: duration.slow, ease: ease.ios },
    },
    inactive: {
      scale: 1,
      borderRadius: 0,
      transition: { duration: duration.slow, ease: ease.ios },
    },
  },

  // ─── List Items (staggered entrance) ──────────────────
  listContainer: {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.04 },
    },
  },

  listItem: {
    hidden: { opacity: 0, y: 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.fast, ease: ease.entrance },
    },
  },

  // ─── Fade In (content after skeleton) ─────────────────
  fadeIn: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: duration.fast, ease: ease.fade },
    },
  },

  // ─── Hero Number (value change) ───────────────────────
  valueChange: {
    initial: { opacity: 0, y: 4 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
  },

  // ─── Reaction / Like (bounce) ─────────────────────────
  reaction: {
    whileTap: { scale: 0.9 },
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
} as const;
