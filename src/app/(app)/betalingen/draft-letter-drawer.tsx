'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { type Bill, formatCents } from '@/lib/bills';

type LetterIntent = 'betalingsregeling' | 'uitstel' | 'bezwaar' | 'bevestiging';
type FlowStep = 'intent' | 'details' | 'generating' | 'result' | 'error';

interface DraftLetterDrawerProps {
  bill: Bill;
  open: boolean;
  onClose: () => void;
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
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }

      const data = await res.json();

      // Null-safe access — API returns { letter: { subject, body } }
      const letter = data?.letter;
      if (!letter || (!letter.subject && !letter.body)) {
        throw new Error('No letter content received');
      }

      setSubject(letter.subject || '');
      setBody(letter.body || '');
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneral'));
      setStep('error');
    }
  }

  async function handleCopy() {
    const fullText = `${subject}\n\n${body}`;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />

      {/* Drawer */}
      <div className="drawer-enter fixed bottom-0 left-0 right-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1 w-10 rounded-full bg-pw-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-pw-purple" strokeWidth={1.5} />
            <h2 className="text-heading-sm text-pw-navy">{t('title')}</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Bill context */}
        <div className="mx-4 mb-4 rounded-input bg-pw-surface px-3 py-2 text-[12px] text-pw-muted">
          {bill.vendor} — {formatCents(bill.amount)}
          {bill.reference ? ` — ${bill.reference}` : ''}
        </div>

        <div className="px-4 pb-8">
          {/* STEP 1: Choose intent */}
          {step === 'intent' && (
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-pw-text">{t('intentQuestion')}</p>

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

          {/* STEP 2: Details based on intent */}
          {step === 'details' && intent && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">
                {t(`detailsQuestion_${intent}`)}
              </p>

              {intent === 'betalingsregeling' && (
                <div className="flex gap-2">
                  {['3', '6', '12'].map((months) => (
                    <button
                      key={months}
                      onClick={() => setDetails(`${months} termijnen`)}
                      className={`btn-press flex-1 rounded-button border py-2.5 text-[13px] font-semibold transition-colors ${
                        details === `${months} termijnen`
                          ? 'border-pw-blue bg-blue-50 text-pw-blue'
                          : 'border-pw-border bg-pw-surface text-pw-text hover:border-pw-blue/50'
                      }`}
                    >
                      {months} {t('months')}
                    </button>
                  ))}
                </div>
              )}

              {intent === 'uitstel' && (
                <div className="flex gap-2">
                  {['14', '30', '60'].map((days) => (
                    <button
                      key={days}
                      onClick={() => setDetails(`${days} dagen uitstel`)}
                      className={`btn-press flex-1 rounded-button border py-2.5 text-[13px] font-semibold transition-colors ${
                        details === `${days} dagen uitstel`
                          ? 'border-pw-blue bg-blue-50 text-pw-blue'
                          : 'border-pw-border bg-pw-surface text-pw-text hover:border-pw-blue/50'
                      }`}
                    >
                      {days} {t('days')}
                    </button>
                  ))}
                </div>
              )}

              {intent === 'bezwaar' && (
                <div className="space-y-2">
                  {[
                    { key: 'amount_wrong', label: t('disputeAmountWrong') },
                    { key: 'not_received', label: t('disputeNotReceived') },
                    { key: 'already_paid', label: t('disputeAlreadyPaid') },
                    { key: 'expired', label: t('disputeExpired') },
                  ].map((reason) => (
                    <button
                      key={reason.key}
                      onClick={() => setDetails(reason.label)}
                      className={`btn-press flex w-full items-center justify-between rounded-card border px-4 py-3 text-[13px] font-semibold transition-colors ${
                        details === reason.label
                          ? 'border-pw-blue bg-blue-50 text-pw-blue'
                          : 'border-pw-border bg-pw-surface text-pw-text hover:border-pw-blue/50'
                      }`}
                    >
                      {reason.label}
                      <ChevronRight className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              )}

              {intent === 'bevestiging' && (
                <div>
                  <label className="mb-1.5 block text-label text-pw-text">{t('paidDate')}</label>
                  <input
                    type="date"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-body text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                  />
                </div>
              )}

              {/* Generate button */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('intent')}
                  className="btn-press flex-1 rounded-button border border-pw-border bg-pw-surface px-4 py-2.5 text-[13px] font-semibold text-pw-text"
                >
                  {t('back')}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!details}
                  className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-purple px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  {t('generate')}
                </button>
              </div>
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
              {/* Subject */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-pw-muted">{t('subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2 text-[13px] font-semibold text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>

              {/* Body */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-pw-muted">{t('letterBody')}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  className="w-full resize-none rounded-card border border-pw-border bg-pw-surface px-3 py-2.5 text-[13px] leading-relaxed text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>

              {/* Legal disclaimer */}
              <p className="text-[10px] text-pw-muted">
                {t('disclaimer')}
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={1.5} />
                  )}
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

              {/* New letter button */}
              <button
                onClick={handleReset}
                className="w-full text-center text-[13px] font-semibold text-pw-purple"
              >
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
              <button
                onClick={handleReset}
                className="btn-press mt-4 rounded-button bg-pw-blue px-6 py-2.5 text-[13px] font-semibold text-white"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function IntentOption({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3.5 text-left transition-colors hover:border-pw-purple/30 hover:bg-purple-50/30"
    >
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-pw-text">{label}</p>
        <p className="text-[11px] text-pw-muted">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
    </button>
  );
}
