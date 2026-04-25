'use client';

import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { haptic } from '@/lib/capacitor';

const THRESHOLD = 70;

export function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
}) {
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll position — only allow pull when at top
  useEffect(() => {
    function handleScroll() {
      setAtTop(window.scrollY <= 0);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Rubber band: 1:1 for first 60px, then 0.4:1 (resistance)
  const pulled = useTransform(y, (v) => (v <= 60 ? v : 60 + (v - 60) * 0.4));
  const spinnerOpacity = useTransform(pulled, [0, THRESHOLD], [0, 1]);
  const spinnerScale = useTransform(pulled, [0, THRESHOLD], [0.5, 1]);
  const spinnerRotate = useTransform(pulled, [0, THRESHOLD], [0, 180]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    animate(y, 50, { type: 'spring', stiffness: 300, damping: 30 });
    await onRefresh();
    animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    setRefreshing(false);
  }, [onRefresh, y]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Spinner — only visible when pulling at top */}
      {atTop && (
        <motion.div
          style={{ opacity: spinnerOpacity, scale: spinnerScale, rotate: spinnerRotate }}
          className="absolute left-1/2 top-4 z-10 -translate-x-1/2"
        >
          <Loader2
            className={`h-6 w-6 text-pw-blue ${refreshing ? 'animate-spin' : ''}`}
          />
        </motion.div>
      )}
      <motion.div
        drag={atTop ? 'y' : false}
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDrag={(_, info) => {
          if (info.offset.y > THRESHOLD && !armed) {
            setArmed(true);
            haptic('confirm');
          } else if (info.offset.y < THRESHOLD && armed) {
            setArmed(false);
          }
        }}
        onDragEnd={async (_, info) => {
          if (info.offset.y > THRESHOLD) {
            await handleRefresh();
          } else {
            animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 });
          }
          setArmed(false);
        }}
        style={{ y: atTop ? pulled : 0 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
