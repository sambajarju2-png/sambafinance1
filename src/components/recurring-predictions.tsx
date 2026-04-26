'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, TrendingUp, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface Pattern {
  vendor: string;
  frequency_days: number;
  typical_amount: number;
  next_expected: string;
  confidence: number;
  category: string;
  occurrences: number;
}

export default function RecurringPredictions() {
  const t = useTranslations('recurring');
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [totalExpected, setTotalExpected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchPatterns();
  }, []);

  async function fetchPatterns() {
    try {
      const res = await fetch('/api/recurring');
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.upcoming || []);
        setTotalExpected(data.total_expected || 0);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      await fetch('/api/recurring/analyze', { method: 'POST' });
      await fetchPatterns();
    } catch { /* silent */ } finally { setAnalyzing(false); }
  }

  function frequencyLabel(days: number): string {
    if (days <= 8) return t('weekly');
    if (days <= 16) return t('biWeekly');
    if (days <= 35) return t('monthly');
    if (days <= 65) return t('biMonthly');
    if (days <= 100) return t('quarterly');
    if (days <= 200) return t('semiAnnual');
    return t('yearly');
  }

  function daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  }

  if (loading) return <div className="skeleton h-[140px] rounded-card" />;

  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
          <p className="text-[14px] font-bold text-pw-navy">{t('title')}</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-1.5 rounded-full bg-pw-blue/10 px-2.5 py-1 text-[11px] font-semibold text-pw-blue disabled:opacity-50"
        >
          {analyzing ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
          ) : (
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
          )}
          {t('analyze')}
        </button>
      </div>

      {patterns.length === 0 ? (
        <div className="py-4 text-center">
          <Calendar className="mx-auto mb-2 h-8 w-8 text-pw-muted/30" strokeWidth={1.5} />
          <p className="text-[12px] text-pw-muted">{t('noPatternsYet')}</p>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="mt-2 text-[12px] font-semibold text-pw-blue"
          >
            {t('runFirstAnalysis')}
          </button>
        </div>
      ) : (
        <>
          {/* Total expected */}
          {totalExpected > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-input bg-pw-blue/5 px-3 py-2">
              <span className="text-[11px] text-pw-muted">{t('expectedNext60')}</span>
              <span className="text-[14px] font-bold text-pw-blue">{formatCents(totalExpected)}</span>
            </div>
          )}

          {/* Pattern list */}
          <div className="space-y-1.5">
            {patterns.slice(0, 5).map((p) => {
              const days = daysUntil(p.next_expected);
              const isPast = days < 0;
              const isSoon = days >= 0 && days <= 7;

              return (
                <div key={p.vendor} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-pw-text truncate">{p.vendor}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-pw-muted">{frequencyLabel(p.frequency_days)}</span>
                      <span className="text-[10px] text-pw-muted">·</span>
                      <span className={`text-[10px] font-semibold ${
                        isPast ? 'text-pw-red' : isSoon ? 'text-amber-600' : 'text-pw-muted'
                      }`}>
                        {isPast
                          ? t('overdue')
                          : days === 0
                            ? t('today')
                            : days === 1
                              ? t('tomorrow')
                              : `${days}d`
                        }
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-[13px] font-bold text-pw-navy">{formatCents(p.typical_amount)}</p>
                    <p className="text-[9px] text-pw-muted">
                      {new Date(p.next_expected).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {patterns.length > 5 && (
            <p className="mt-2 text-center text-[10px] text-pw-muted">
              + {patterns.length - 5} {t('morePatterns')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
