'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Mounts its children only once they scroll near the viewport. Used to keep
 * below-fold dashboard widgets (and their API fetches + JS chunks) off the
 * initial load critical path, so they don't compete with the above-fold
 * content for connections/main-thread time during first paint.
 *
 * rootMargin pre-mounts slightly before the widget is visible so it's ready by
 * the time the user reaches it. Falls back to mounting immediately if
 * IntersectionObserver is unavailable.
 */
export default function LazyOnView({
  children,
  rootMargin = '300px',
  minHeight,
}: {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return (
    <div ref={ref} style={!inView && minHeight ? { minHeight } : undefined}>
      {inView ? children : null}
    </div>
  );
}
