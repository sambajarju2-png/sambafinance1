'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { haptic } from '@/lib/capacitor';

/**
 * iOS-exact toggle switch.
 * 51×31px, 27px knob, system green #34C759.
 * Knob compresses horizontally when held (width 27→32).
 */
export function IOSSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => {
        haptic('select');
        onChange(!checked);
      }}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full disabled:opacity-50"
      style={{
        backgroundColor: checked ? '#34C759' : '#E9E9EB',
        transition: 'background-color 0.2s',
      }}
    >
      <motion.div
        animate={{
          x: checked ? 20 : 0,
          width: pressed ? 32 : 27,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="absolute left-[2px] top-[2px] h-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
      />
    </button>
  );
}
