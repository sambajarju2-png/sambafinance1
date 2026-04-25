'use client';

import { motion, useMotionValue, animate } from 'motion/react';
import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { haptic } from '@/lib/capacitor';
import { spring } from '@/lib/motion';

const REVEAL_WIDTH = 160;           // 2 buttons × 80px
const AUTO_COMPLETE_THRESHOLD = 240; // drag past this → auto-delete (Apple Mail trick)

/**
 * Swipeable bill card with Apple Mail-style actions.
 * - Swipe left to reveal "Mark Paid" + "Delete"
 * - Drag past 240px → auto-complete delete (power user shortcut)
 * - Snap points with haptic feedback
 */
export function SwipeableBillCard({
  children,
  onMarkPaid,
  onDelete,
}: {
  children: React.ReactNode;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Action layer (underneath) */}
      <div className="absolute inset-y-0 right-0 flex">
        <button
          onClick={() => {
            haptic('success');
            onMarkPaid();
            animate(x, 0, spring.snap);
            setRevealed(false);
          }}
          className="flex h-full w-20 items-center justify-center bg-emerald-500 text-white"
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            haptic('heavy');
            onDelete();
          }}
          className="flex h-full w-20 items-center justify-center bg-red-500 text-white"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Card layer (draggable) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -AUTO_COMPLETE_THRESHOLD, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        style={{ x }}
        onDragEnd={(_, info) => {
          const offset = info.offset.x;
          if (offset < -AUTO_COMPLETE_THRESHOLD * 0.9) {
            // Power user: dragged all the way → auto-delete
            haptic('heavy');
            onDelete();
          } else if (offset < -REVEAL_WIDTH / 2) {
            // Reveal action buttons
            haptic('select');
            animate(x, -REVEAL_WIDTH, spring.snap);
            setRevealed(true);
          } else {
            // Snap back
            animate(x, 0, spring.snap);
            setRevealed(false);
          }
        }}
        onClick={() => {
          if (revealed) {
            animate(x, 0, spring.snap);
            setRevealed(false);
          }
        }}
        className="relative bg-pw-surface gesture-x"
      >
        {children}
      </motion.div>
    </div>
  );
}
