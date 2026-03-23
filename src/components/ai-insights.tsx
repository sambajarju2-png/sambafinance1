'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Zap, Loader2, AlertTriangle, AlertCircle, Users, Share2, Copy, Check } from 'lucide-react';
import { type Bill } from '@/lib/bills';

interface Insight {
  type: 'priority' | 'warning' | 'pattern' | 'tip';
  title: string;
  description: string;
  bill_id: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

interface CachedInsights { insights: Insight[]; summary: string; timestamp: number; }

const URGENCY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: 'border-pw-red/30', bg: 'bg-red-50/50', icon: 'text-pw-red' },
  high: { border: 'border-pw-orange/30', bg: 'bg-orange-50/50', icon: 'text-pw-orange' },
  medium: { border: 'border-pw-amber/30', bg: 'bg-amber-50/50', icon: 'text-pw-amber' },
  low: { border: 'border-pw-blue/30', bg: 'bg-blue-50/50', icon: 'text-pw-blue' },
};

const INSIGHTS_CACHE_KEY = 'pw-insights-cache';
function getCachedInsights(): CachedInsights | null { try { const raw = sessionStorage.getItem(INSIGHTS_CACHE_KEY); if (!raw) return null; const parsed = JSON.parse(raw); if (Date.now() - parsed.timestamp > 30 * 60 * 1000) return null; return parsed; } catch { return null; } }
function setCachedInsights(data: CachedInsights): void { try { sessionStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(data)); } catch {} }

export default function AiInsightsPanel({ bills }: { bills: Bill[] }) {
  const t = useTranslations('stats');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [hitLimit, setHitLimit] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { const cached = getCachedInsights(); if (cached) { setInsights(cached.insights); setSummary(cached.summary); setHasAnalyzed(true); } }, []);
  useEffect(() => { fetch('/api/referral').then(r => r.json()).then(d => setShareUrl(d.share_url || '')).catch(() => {}); }, []);

  async function handleAnalyze() {
    setLoading(true); setError(null); setHitLimit(false);
    try {
      const res = await fetch('/api/insights', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'insight_limit') { setHitLimit(true); setLoading(false); return; }
        throw new Error(data.error || 'Failed');
      }
      setInsights(data.insights || []); setSummary(data.summary || ''); setHasAnalyzed(true);
      setCachedInsights({ insights: data.insights || [], summary: data.summary || '', timestamp: Date.now() });
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); } finally { setLoading(false); }
  }

  async function handleShare() {
    if (navigator.share) { try { await navigator.share({ title: 'PayWatch', text: 'Probeer PayWatch — rust in je hoofd over elke rekening.', url: shareUrl }); } catch {} }
    else { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  if (bills.length === 0) return (
    <div className="flex flex-col items-center py-16 text-center">
      <Zap className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
      <h2 className="text-[16px] font-semibold text-pw-text">{t('noData')}</h2>
      <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">{t('noDataHint')}</p>
    </div>
  );

  if (hitLimit) {
    return (
      <div className="space-y-4">
        <div className="relative">
          <div className="pointer-events-none select-none blur-[6px] opacity-50">
            <div className="rounded-card border border-pw-purple/20 bg-purple-50/30 px-4 py-3"><p className="text-[13px] text-pw-muted">AI insight preview...</p></div>
            <div className="mt-2 rounded-card border border-pw-amber/30 bg-amber-50/50 px-4 py-3"><p className="text-[13px] text-pw-muted">Priority insight...</p></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="mx-4 w-full max-w-sm rounded-card-lg border-2 border-pw-purple/20 bg-pw-surface p-6 shadow-lg">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-purple/10 mb-3">
                  <Users className="h-7 w-7 text-pw-purple" strokeWidth={1.5} />
                </div>
                <h3 className="text-[16px] font-bold text-pw-navy">Nodig een vriend uit</h3>
                <p className="mt-1 text-[12px] text-pw-muted leading-relaxed">Je hebt je gratis AI-inzichten gebruikt. Nodig een vriend uit voor meer.</p>
                <div className="mt-3 w-full space-y-1 text-left">
                  <p className="text-[11px] text-pw-muted">1 vriend = alle functies + 10 extra inzichten</p>
                  <p className="text-[11px] text-pw-muted">2 vrienden = 20 extra inzichten</p>
                  <p className="text-[11px] text-pw-green font-semibold">3+ vrienden = onbeperkt</p>
                </div>
                {shareUrl && (
                  <button onClick={handleShare} className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-button bg-pw-purple px-4 py-2.5 text-[13px] font-semibold text-white">
                    {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Share2 className="h-4 w-4" strokeWidth={1.5} />}
                    {copied ? 'Gekopieerd!' : 'Deel met een vriend'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hasAnalyzed && !loading && (
        <div className="flex flex-col items-center rounded-card border border-dashed border-pw-purple/30 bg-purple-50/30 py-8 text-center">
          <Zap className="mb-3 h-10 w-10 text-pw-purple" strokeWidth={1.5} />
          <h2 className="text-[14px] font-semibold text-pw-text">{t('aiTitle')}</h2>
          <p className="mt-1 max-w-[260px] text-[12px] text-pw-muted">{t('aiDescription')}</p>
          <button onClick={handleAnalyze} className="btn-press mt-4 flex items-center gap-2 rounded-button bg-pw-purple px-6 py-2.5 text-[13px] font-semibold text-white"><Zap className="h-4 w-4" strokeWidth={1.5} />{t('analyze')}</button>
        </div>
      )}
      {loading && (<div className="flex flex-col items-center py-12 text-center"><Loader2 className="mb-4 h-8 w-8 animate-spin text-pw-purple" strokeWidth={1.5} /><p className="text-[14px] font-medium text-pw-muted">{t('analyzing')}</p></div>)}
      {error && (<div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} /><p className="text-label text-pw-red">{error}</p></div>)}
      {hasAnalyzed && !loading && (
        <>
          {summary && (<div className="rounded-card border border-pw-purple/20 bg-purple-50/30 px-4 py-3"><p className="text-[13px] font-medium text-pw-text">{summary}</p></div>)}
          <div className="space-y-2">
            {insights.map((insight, i) => {
              const style = URGENCY_STYLES[insight.urgency] || URGENCY_STYLES.low;
              return (<div key={i} className={`rounded-card border ${style.border} ${style.bg} px-4 py-3`}><div className="flex items-start gap-3">{insight.type === 'priority' || insight.type === 'warning' ? <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.icon}`} strokeWidth={1.5} /> : <Zap className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.icon}`} strokeWidth={1.5} />}<div className="flex-1"><p className="text-[13px] font-bold text-pw-text">{insight.title}</p><p className="mt-0.5 text-[12px] text-pw-muted"><BoldHighlight text={insight.description} /></p></div></div></div>);
            })}
          </div>
          <button onClick={handleAnalyze} disabled={loading} className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-purple/30 bg-purple-50/30 px-4 py-2.5 text-[13px] font-semibold text-pw-purple disabled:opacity-50"><Zap className="h-4 w-4" strokeWidth={1.5} />{t('reAnalyze')}</button>
        </>
      )}
    </div>
  );
}

function BoldHighlight({ text }: { text: string }) {
  const parts = text.split(/(€[\d.,]+(?:\s*(?:per\s+maand|extra))?|\d+%|\d+\s+dagen?|"[^"]+"|'[^']+')/g);
  return (<>{parts.map((part, i) => /^€|^\d+%|^\d+\s+dag|^["']/.test(part) ? <strong key={i} className="font-bold text-pw-text">{part}</strong> : <span key={i}>{part}</span>)}</>);
}
