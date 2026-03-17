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

/**
 * Safely extract subject and body from the API response.
 * Handles multiple response formats:
 * 1. { letter: { subject, body } }  — expected format
 * 2. { subject, body }               — direct format
 * 3. Raw JSON string in body          — parse and extract
 */
function extractLetterData(data: Record<string, unknown>): { subject: string; body: string } {
  // Format 1: { letter: { subject, body } }
  if (data.letter && typeof data.letter === 'object') {
    const letter = data.letter as Record<string, unknown>;
    return {
      subject: String(letter.subject || ''),
      body: cleanBody(String(letter.body || '')),
    };
  }

  // Format 2: { subject, body }
  if (data.subject || data.body) {
    return {
      subject: String(data.subject || ''),
      body: cleanBody(String(data.body || '')),
    };
  }

  // Fallback: try to find JSON in any string field
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && value.includes('"subject"')) {
      try {
        let cleaned = value.trim();
        // Strip markdown fences
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
        }
        const parsed = JSON.parse(cleaned);
        if (parsed.subject || parsed.body) {
          return {
            subject: String(parsed.subject || ''),
            body: cleanBody(String(parsed.body || '')),
          };
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  return { subject: '', body: '' };
}

/**
 * Clean up the body text:
 * - Replace literal \n with actual newlines
 * - Strip any remaining JSON artifacts
 */
function cleanBody(text: string): string {
  let cleaned = text;

  // If the text starts with ``` or { and looks like JSON, try to extract the body
  if (cleaned.startsWith('```') || (cleaned.startsWith('{') && cleaned.includes('"body"'))) {
    try {
      let jsonStr = cleaned;
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.body) {
        cleaned = String(parsed.body);
      }
    } catch {
      // Not JSON, use as-is
    }
  }

  // Replace literal escaped newlines with actual newlines
  cleaned = cleaned
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .trim();

  return cleaned;
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
        throw new Error(errData.error || 'Failed');
      }

      const data = await res.json();

      // Use robust extraction that handles all response formats
      const extracted = extractLetterData(data);
      setSubject(extracted.subject);
      setBody(extracted.body);
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
      // Fallback for older browsers
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
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-[20px] bg-pw-surface drawer-enter">
        {/* Handle bar */}
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

          {/* STEP 2: Details */}
          {step === 'details' && intent === 'betalingsregeling' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('howManyMonths')}</p>
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
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('intent'); setDetails(''); }}
                  className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
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

          {step === 'details' && intent === 'uitstel' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('howManyDays')}</p>
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
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('intent'); setDetails(''); }}
                  className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
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

          {step === 'details' && intent === 'bezwaar' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('disputeReason')}</p>
              <div className="space-y-2">
                {[
                  { value: 'bedrag klopt niet', label: t('reasonAmountWrong') },
                  { value: 'dienst niet ontvangen', label: t('reasonNotReceived') },
                  { value: 'al betaald', label: t('reasonAlreadyPaid') },
                  { value: 'verjaard', label: t('reasonExpired') },
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
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('intent'); setDetails(''); }}
                  className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
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

          {step === 'details' && intent === 'bevestiging' && (
            <div className="space-y-4">
              <p className="text-[14px] font-semibold text-pw-text">{t('paidDate')}</p>
              <input
                type="date"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-[14px] text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setStep('intent'); setDetails(''); }}
                  className="btn-press flex-1 rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted"
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
                <label className="mb-1 block text-[11px] font-medium text-pw-purple">{t('subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-input border border-pw-border bg-pw-surface px-3 py-2 text-[13px] font-semibold text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>

              {/* Body */}
              <div>
                <label className="mb-1 block text-[11px] font-medium text-pw-purple">{t('letterBody')}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full resize-none rounded-card border border-pw-border bg-pw-surface px-3 py-2.5 text-[13px] leading-relaxed text-pw-text focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
                />
              </div>

              {/* Legal disclaimer */}
              <p className="text-[10px] italic text-pw-muted">
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
