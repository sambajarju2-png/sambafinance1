'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Lightbulb, TrendingUp } from 'lucide-react';

interface Insight {
  available?: boolean;
  summary?: string;
  highlights?: { label: string; detail: string }[];
  tip?: string;
}

// Only show the monthly money summary on the analytical tabs.
const RELEVANT_TABS = new Set(['uitgaven', 'inkomen', 'geldstroom', 'trend']);

export function InsightCard({ month, tab }: { month: string; tab: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!month || !RELEVANT_TABS.has(tab)) return;
    let cancelled = false;
    setLoading(true);
    setInsight(null);
    fetch(`/api/analytics/insight?month=${encodeURIComponent(month)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInsight(d); })
      .catch(() => { if (!cancelled) setInsight({ available: false }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, tab]);

  if (!RELEVANT_TABS.has(tab)) return null;

  if (loading) {
    return (
      <div className="mt-4 rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pw-blue" />
          <span className="text-[13px] font-semibold text-pw-text">Inzicht</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-pw-border" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-pw-border" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-pw-border" />
        </div>
      </div>
    );
  }

  if (!insight || insight.available === false || !insight.summary) return null;

  return (
    <div className="mt-4 rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-pw-blue" />
        <span className="text-[13px] font-semibold text-pw-text">Inzicht</span>
      </div>

      <p className="text-[13px] leading-relaxed text-pw-text">{insight.summary}</p>

      {insight.highlights && insight.highlights.length > 0 && (
        <div className="mt-3 space-y-2">
          {insight.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-none text-pw-muted" />
              <div className="text-[12px] leading-snug">
                <span className="font-medium text-pw-text">{h.label}</span>
                {h.detail && <p className="text-pw-muted">{h.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {insight.tip && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-pw-bg p-2.5">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-none text-pw-amber" />
          <p className="text-[12px] leading-snug text-pw-text">{insight.tip}</p>
        </div>
      )}

      <p className="mt-3 text-[10px] text-pw-muted">Gemaakt met AI op basis van je transacties</p>
    </div>
  );
}
