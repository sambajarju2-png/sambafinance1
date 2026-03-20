'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  FileText,
  Loader2,
  Copy,
  Mail,
  Check,
  ChevronRight,
  AlertCircle,
  Users,
  Share2,
} from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';

type LetterIntent = 'betalingsregeling' | 'uitstel' | 'bezwaar' | 'bevestiging';
type FlowStep = 'intent' | 'details' | 'generating' | 'result' | 'error' | 'referral';

interface DraftLetterDrawerProps {
  bill: Bill;
  open: boolean;
  onClose: () => void;
}

/**
 * Clean the letter body from any JSON/markdown artifacts.
 */
function cleanLetterBody(raw: string): string {
  let text = raw;

  // If the whole thing looks like JSON, try to extract just the body field
  if (text.trim().startsWith('{') || text.trim().startsWith('```')) {
    let jsonStr = text.trim();
    // Strip markdown fences
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.body) return cleanLetterBody(String(parsed.body));
      if (parsed.letter?.body) return cleanLetterBody(String(parsed.letter.body));
    } catch {
      // Not valid JSON — use as-is
    }
  }

  // Replace literal escaped newlines
  text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').trim();
  return text;
}

/**
 * Extract subject from API response, handling all possible formats.
 */
function cleanLetterSubject(raw: string): string {
  let text = raw;
  if (text.trim().startsWith('{') || text.trim().startsWith('```')) {
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
    }
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.subject) return String(parsed.subject);
      if (parsed.letter?.subject) return String(parsed.letter.subject);
    } catch {
      // not JSON
    }
  }
  return text.replace(/\\n/g, ' ').trim();
}

export default function DraftLetterDrawer({ bill, open, onClose }: DraftLetterDrawerProps) {
  const t = useTranslations('draftLetter');

  const [step, setStep] = useState<FlowStep>('intent');
  const [intent, setIntent] = useState<LetterIntent | null>(null);
  const [details, setDetails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  function handleIntentSelect(selected: LetterIntent) {
    setIntent(selected);
    setStep('details');
  }

  async function handleGenerate() {
    if (!intent) return;
    setStep('generating');
    setError(null);

    try {
      const res = await fetch('/api/draft-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_id: bill.id,
          intent,
          details,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        if (errData.error === 'letter_limit') {
          setStep('referral');
          return;
        }
        throw new Error(errData.error || 'Failed');
      }

      const data = await res.json();

      // Handle { letter: { subject, body } } format
      const letterObj = data.letter || data;
      const rawSubject = String(letterObj.subject || '');
      const rawBody = String(letterObj.body || '');

      setSubject(cleanLetterSubject(rawSubject));
      setBody(cleanLetterBody(rawBody));
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
      setStep('error');
    }
  }

  async function handleCopy() {
    try {
      const fullText = subject ? `${subject}\n\n${body}` : body;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = subject ? `${subject}\n\n${body}` : body;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleEmail() {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  }

  function handleReset() {
    setStep('intent');
    setIntent(null);
    setDetails('');
    setSubject('');
    setBody('');
    setError(null);
    setCopied(false);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[20px] bg-pw-surface drawer-enter">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        <div className="px-5 pb-8">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-pw-purple" strokeWidth={1.5} />
              <h2 className="text-heading text-pw-navy">{t('title')}</h2>
            </div>
            <button onClick={handleClose} className="p-1">
              <X className="h-5 w-5 text-pw-muted" strokeWidth={1.5} />
            </button>
          </div>

          {/* Bill info */}
          <p className="mb-5 text-[13px] text-pw-muted">
            {bill.vendor} — {formatCents(bill.amount)} — {bill.reference || bill.vendor}
          </p>

          {/* STEP 1: Choose intent */}
          {step === 'intent' && (
            <div className="space-y-3">
              <IntentOption
                label={t('intentPaymentPlan')}
                description={t('intentPaymentPlanDesc')}
                onClick={() => handleIntentSelect('betalingsregeling')}
              />
              <IntentOption
                label={t('intentPostpone')}
                description={t('intentPostponeDesc')}
                onClick={() => handleIntentSelect('uitstel')}
              />
              <IntentOption
                label={t('intentDispute')}
                description={t('intentDisputeDesc')}
                onClick={() => handleIntentSelect('bezwaar')}
              />
              <IntentOption
                label={t('intentConfirmPaid')}
                description={t('intentConfirmPaidDesc')}
                onClick={() => handleIntentSelect('bevestiging')}
              />
            </div>
          )}

          {/* STEP 2: Details — Payment plan */}
          {step === 'details' && intent === 'betalingsregeling' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('detailsQuestion_betalingsregeling')}</p>
              <div className="flex gap-3">
                {['3', '6', '12'].map((months) => (
                  <button
                    key={months}
                    onClick={() => setDetails(`${months} maanden`)}
                    className={`btn-press flex-1 rounded-card border px-3 py-3 text-center text-[14px] font-semibold transition-colors ${
                      details === `${months} maanden`
                        ? 'border-pw-purple bg-purple-50 text-pw-purple'
                        : 'border-pw-border bg-pw-surface text-pw-text'
                    }`}
                  >
                    {months} {t('months')}
                  </button>
                ))}
              </div>
              <DetailsButtons onBack={() => { setStep('intent'); setDetails(''); }} onGenerate={handleGenerate} disabled={!details} t={t} />
            </div>
          )}

          {/* STEP 2: Details — Postpone */}
          {step === 'details' && intent === 'uitstel' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('detailsQuestion_uitstel')}</p>
              <div className="flex gap-3">
                {['14', '30', '60'].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDetails(`${days} dagen`)}
                    className={`btn-press flex-1 rounded-card border px-3 py-3 text-center text-[14px] font-semibold transition-colors ${
                      details === `${days} dagen`
                        ? 'border-pw-purple bg-purple-50 text-pw-purple'
                        : 'border-pw-border bg-pw-surface text-pw-text'
                    }`}
                  >
                    {days} {t('days')}
                  </button>
                ))}
              </div>
              <DetailsButtons onBack={() => { setStep('intent'); setDetails(''); }} onGenerate={handleGenerate} disabled={!details} t={t} />
            </div>
          )}

          {/* STEP 2: Details — Dispute */}
          {step === 'details' && intent === 'bezwaar' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('detailsQuestion_bezwaar')}</p>
              <div className="space-y-2">
                {[
                  { value: 'bedrag klopt niet', label: t('disputeAmountWrong') },
                  { value: 'dienst niet ontvangen', label: t('disputeNotReceived') },
                  { value: 'al betaald', label: t('disputeAlreadyPaid') },
                  { value: 'verjaard', label: t('disputeExpired') },
                ].map((reason) => (
                  <button
                    key={reason.value}
                    onClick={() => setDetails(reason.value)}
                    className={`btn-press w-full rounded-card border px-4 py-3 text-left text-[13px] font-semibold transition-colors ${
                      details === reason.value
                        ? 'border-pw-purple bg-purple-50 text-pw-purple'
                        : 'border-pw-border bg-pw-surface text-pw-text'
                    }`}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
              <DetailsButtons onBack={() => { setStep('intent'); setDetails(''); }} onGenerate={handleGenerate} disabled={!details} t={t} />
            </div>
          )}

          {/* STEP 2: Details — Confirm paid */}
          {step === 'details' && intent === 'bevestiging' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('detailsQuestion_bevestiging')}</p>
              <input
                type="date"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
              <DetailsButtons onBack={() => { setStep('intent'); setDetails(''); }} onGenerate={handleGenerate} disabled={!details} t={t} />
            </div>
          )}

          {/* STEP 3: Generating */}
          {step === 'generating' && (
            <div className="flex flex-col items-center py-12 text-center">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-pw-purple" strokeWidth={1.5} />
              <p className="text-[14px] font-medium text-pw-muted">{t('generating')}</p>
            </div>
          )}

          {/* STEP 4: Result */}
          {step === 'result' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-pw-purple">{t('subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2 text-[13px] font-semibold text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-pw-purple">{t('letterBody')}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full resize-none rounded-card border border-pw-border bg-pw-surface px-3 py-2.5 text-[13px] leading-relaxed text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>
              <p className="text-[10px] italic text-pw-muted">{t('disclaimer')}</p>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text"
                >
                  {copied ? <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
                  {copied ? t('copied') : t('copy')}
                </button>
                <button
                  onClick={handleEmail}
                  className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.5} />
                  {t('openEmail')}
                </button>
              </div>
              <button onClick={handleReset} className="w-full text-center text-[13px] font-semibold text-pw-purple">
                {t('newLetter')}
              </button>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-8 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-pw-red" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-pw-text">{t('errorTitle')}</p>
              <p className="mt-1 text-[13px] text-pw-muted">{error || t('errorGeneral')}</p>
              <button onClick={handleReset} className="btn-press mt-4 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white">
                {t('tryAgain')}
              </button>
            </div>
          )}

          {/* REFERRAL GATE — shown when letter limit reached */}
          {step === 'referral' && (
            <ReferralGateCard onClose={onClose} />
          )}
        </div>
      </div>
    </>
  );
}

function ReferralGateCard({ onClose }: { onClose: () => void }) {
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referral').then(r => r.json()).then(d => setShareUrl(d.share_url || '')).catch(() => {});
  }, []);

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'PayWatch', text: 'Probeer PayWatch — rust in je hoofd over elke rekening.', url: shareUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue/10 mb-3">
        <Users className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
      </div>
      <h3 className="text-[16px] font-bold text-pw-navy">Nodig een vriend uit</h3>
      <p className="mt-2 text-[12px] text-pw-muted leading-relaxed max-w-[260px]">
        Je hebt je gratis brieven gebruikt. Nodig een vriend uit om meer te ontgrendelen.
      </p>
      <div className="mt-3 w-full space-y-2 text-left">
        <p className="text-[11px] text-pw-muted">1 vriend = alle functies + 10 extra brieven</p>
        <p className="text-[11px] text-pw-muted">2 vrienden = 20 extra brieven</p>
        <p className="text-[11px] text-pw-green font-semibold">3+ vrienden = onbeperkt</p>
      </div>
      {shareUrl && (
        <button onClick={handleShare}
          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
          {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Share2 className="h-4 w-4" strokeWidth={1.5} />}
          {copied ? 'Gekopieerd!' : 'Deel met een vriend'}
        </button>
      )}
      <button onClick={onClose} className="mt-2 text-[12px] text-pw-muted">Sluiten</button>
    </div>
  );
}

function IntentOption({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3.5 text-left transition-colors hover:border-pw-purple/30 hover:bg-purple-50/30">
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
    </button>
  );
}

function DetailsButtons({ onBack, onGenerate, disabled, t }: { onBack: () => void; onGenerate: () => void; disabled: boolean; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onBack} className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
        {t('back')}
      </button>
      <button onClick={onGenerate} disabled={disabled} className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-purple px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
        <FileText className="h-4 w-4" strokeWidth={1.5} />
        {t('generate')}
      </button>
    </div>
  );
}
