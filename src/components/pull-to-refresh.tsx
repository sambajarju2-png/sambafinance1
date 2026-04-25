'use client';

import { useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { haptic } from '@/lib/capacitor';

const THRESHOLD = 70;
const RESISTANCE = 0.4;

/**
 * PullToRefresh using native touch events — does NOT block page scrolling.
 * Only activates when page is at scrollY=0 and user pulls down.
 */
export function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
}) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const armed = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) {
      if (isDragging.current) {
        isDragging.current = false;
        setPulling(false);
        setPullDistance(0);
      }
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff <= 0) {
      // Scrolling up — let browser handle it
      if (isDragging.current) {
        isDragging.current = false;
        setPulling(false);
        setPullDistance(0);
      }
      return;
    }

    // Pulling down from top
    isDragging.current = true;
    setPulling(true);

    // Apply resistance after 60px
    const distance = diff <= 60 ? diff : 60 + (diff - 60) * RESISTANCE;
    setPullDistance(distance);

    if (distance >= THRESHOLD && !armed.current) {
      armed.current = true;
      haptic('confirm');
    } else if (distance < THRESHOLD) {
      armed.current = false;
    }

    // Prevent page scroll while pulling
    if (diff > 10) {
      e.preventDefault();
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(50);
      await onRefresh();
      setRefreshing(false);
    }

    setPulling(false);
    setPullDistance(0);
    armed.current = false;
  }, [pullDistance, onRefresh]);

  const spinnerOpacity = Math.min(pullDistance / THRESHOLD, 1);
  const spinnerScale = 0.5 + spinnerOpacity * 0.5;
  const spinnerRotate = (pullDistance / THRESHOLD) * 180;

  return (
    <div
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Spinner */}
      {(pulling || refreshing) && (
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{
            top: 16,
            opacity: refreshing ? 1 : spinnerOpacity,
            transform: `scale(${refreshing ? 1 : spinnerScale}) rotate(${refreshing ? 0 : spinnerRotate}deg)`,
          }}
        >
          <Loader2
            className={`h-6 w-6 text-pw-blue ${refreshing ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      {/* Content — translated down when pulling, NO drag blocking */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: !pulling && !refreshing ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
