'use client';

import { useState } from 'react';
import { X, Flag, Loader2, Check } from 'lucide-react';

const REPORT_REASONS = [
  { key: 'racism', label: 'Racisme / discriminatie', icon: '🚫' },
  { key: 'scam', label: 'Oplichting / scam', icon: '💰' },
  { key: 'harassment', label: 'Intimidatie / pesten', icon: '😡' },
  { key: 'spam', label: 'Spam / reclame', icon: '📢' },
  { key: 'misinformation', label: 'Onjuiste informatie', icon: '❌' },
  { key: 'inappropriate', label: 'Ongepaste inhoud', icon: '⚠️' },
  { key: 'other', label: 'Anders', icon: '📝' },
] as const;

interface ReportDrawerProps {
  type: 'post' | 'comment';
  targetId: string;
  authorName: string;
  contentPreview: string;
  onClose: () => void;
  onReported: () => void;
}

export default function ReportDrawer({ type, targetId, authorName, contentPreview, onClose, onReported }: ReportDrawerProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!selectedReason) return;
    setSubmitting(true);
    setError('');

    try {
      const body: Record<string, string> = {
        reason: selectedReason,
      };
      if (type === 'post') body.post_id = targetId;
      else body.comment_id = targetId;
      if (details.trim()) body.details = details.trim();

      const res = await fetch('/api/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onReported();
          onClose();
        }, 1500);
      } else {
        const data = await res.json();
        setError(data.error || 'Er ging iets mis');
      }
    } catch {
      setError('Verbindingsfout');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
        <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
          <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>
          <div className="flex flex-col items-center py-12 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-green/10 mb-4">
              <Check className="h-7 w-7 text-pw-green" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-bold text-pw-navy">Bedankt voor je melding</h3>
            <p className="mt-2 text-[13px] text-pw-muted text-center max-w-[260px]">
              We bekijken dit zo snel mogelijk. Samen houden we de community veilig.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-5 pb-8 pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pw-red/10">
                <Flag className="h-4 w-4 text-pw-red" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-pw-navy">
                  {type === 'post' ? 'Post melden' : 'Reactie melden'}
                </h2>
                <p className="text-[11px] text-pw-muted">van {authorName}</p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Content preview */}
          <div className="rounded-card border border-pw-border bg-pw-surface p-3 mb-5">
            <p className="text-[12px] text-pw-muted leading-relaxed line-clamp-3">
              &ldquo;{contentPreview.length > 120 ? contentPreview.slice(0, 120) + '...' : contentPreview}&rdquo;
            </p>
          </div>

          {/* Reason selection */}
          <p className="text-[12px] font-semibold text-pw-muted uppercase tracking-wider mb-3">
            Waarom meld je dit?
          </p>
          <div className="space-y-2 mb-5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelectedReason(r.key)}
                className={`btn-press flex w-full items-center gap-3 rounded-card border-2 px-3.5 py-3 text-left transition-all ${
                  selectedReason === r.key
                    ? 'border-pw-red/40 bg-red-50/50'
                    : 'border-pw-border bg-pw-surface'
                }`}
              >
                <span className="text-[16px]">{r.icon}</span>
                <span className={`text-[13px] font-semibold ${
                  selectedReason === r.key ? 'text-pw-red' : 'text-pw-text'
                }`}>
                  {r.label}
                </span>
                {selectedReason === r.key && (
                  <div className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-pw-red">
                    <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Optional details */}
          <p className="text-[12px] font-semibold text-pw-muted uppercase tracking-wider mb-2">
            Toelichting (optioneel)
          </p>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Leg uit wat er mis is..."
            className="w-full rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-red focus:outline-none focus:ring-1 focus:ring-pw-red/30 mb-1"
          />
          <p className="text-[10px] text-pw-muted mb-4">{details.length}/300</p>

          {error && (
            <div className="rounded-card border border-pw-red/20 bg-red-50/50 p-3 mb-4">
              <p className="text-[12px] text-pw-red">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || submitting}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-red px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Flag className="h-4 w-4" strokeWidth={1.5} />
            )}
            {submitting ? 'Melding versturen...' : 'Melding versturen'}
          </button>
        </div>
      </div>
    </>
  );
}
