'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Star, Loader2, MessageSquare, Heart } from 'lucide-react';

export default function FeedbackPopup() {
  const t = useTranslations('feedback');
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const feedbackState = localStorage.getItem('paywatch-feedback');
    if (feedbackState === 'submitted' || feedbackState === 'dismissed') return;

    async function checkEligibility() {
      try {
        const res = await fetch('/api/feedback');
        if (res.ok) {
          const data = await res.json();
          if (data.eligible && !data.already_submitted) {
            setTimeout(() => setShow(true), 5000);
          }
          if (data.already_submitted) {
            localStorage.setItem('paywatch-feedback', 'submitted');
          }
        }
      } catch { /* silent */ }
    }
    checkEligibility();
  }, []);

  // Listen for admin trigger
  useEffect(() => {
    function handleTrigger() { setRating(0); setHoverRating(0); setText(''); setDone(false); setShow(true); }
    window.addEventListener('paywatch-trigger-feedback', handleTrigger);
    return () => window.removeEventListener('paywatch-trigger-feedback', handleTrigger);
  }, []);

  async function handleSubmit() {
    if (rating === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback_text: text.trim() || null }),
      });
      if (res.ok) {
        setDone(true);
        localStorage.setItem('paywatch-feedback', 'submitted');
        setTimeout(() => setShow(false), 2500);
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  function handleDismiss() {
    setShow(false);
    localStorage.setItem('paywatch-feedback', 'dismissed');
  }

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={handleDismiss} />
      <div className="fixed inset-x-4 top-1/2 z-[60] -translate-y-1/2 mx-auto max-w-sm">
        <div className="rounded-card-lg bg-pw-surface p-6 shadow-[var(--shadow-modal)]">
          <button onClick={handleDismiss} className="absolute right-3 top-3 p-1 text-pw-muted hover:text-pw-text">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {done ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-green/10 mb-3">
                <Heart className="h-7 w-7 text-pw-green" strokeWidth={1.5} />
              </div>
              <h3 className="text-[18px] font-bold text-pw-navy">{t('thankYouTitle')}</h3>
              <p className="mt-2 text-[13px] text-pw-muted">{t('thankYouDesc')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-pw-blue/10 mb-3">
                  <MessageSquare className="h-6 w-6 text-pw-blue" strokeWidth={1.5} />
                </div>
                <h3 className="text-[18px] font-bold text-pw-navy text-center">{t('title')}</h3>
                <p className="mt-1 text-[12px] text-pw-muted text-center">{t('desc')}</p>
              </div>

              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)} className="btn-press p-1">
                    <Star className={`h-8 w-8 transition-colors ${n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-pw-border'}`} strokeWidth={1.5} />
                  </button>
                ))}
              </div>

              {rating > 0 && (
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t('placeholder')}
                  className="mb-4 w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2.5 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none" />
              )}

              <div className="flex gap-3">
                <button onClick={handleDismiss} className="flex-1 rounded-button border border-pw-border px-3 py-2.5 text-[13px] font-semibold text-pw-muted">{t('later')}</button>
                <button onClick={handleSubmit} disabled={rating === 0 || saving}
                  className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-button bg-pw-blue px-3 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
                  {t('submit')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
