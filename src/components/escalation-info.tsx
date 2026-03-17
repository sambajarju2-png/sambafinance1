'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, ExternalLink, Shield, Info } from 'lucide-react';
import { type EscalationStage, formatCents } from '@/lib/bills';
import { calculateWIKCosts, getStageDescription } from '@/lib/wik';

const STAGE_ORDER: EscalationStage[] = ['factuur', 'herinnering', 'aanmaning', 'incasso', 'deurwaarder'];

const STAGE_COLORS: Record<EscalationStage, { bg: string; border: string; text: string; dot: string }> = {
  factuur: { bg: 'bg-blue-50', border: 'border-pw-blue/20', text: 'text-pw-blue', dot: 'bg-pw-blue' },
  herinnering: { bg: 'bg-amber-50', border: 'border-pw-amber/20', text: 'text-pw-amber', dot: 'bg-pw-amber' },
  aanmaning: { bg: 'bg-orange-50', border: 'border-pw-orange/20', text: 'text-pw-orange', dot: 'bg-pw-orange' },
  incasso: { bg: 'bg-red-50', border: 'border-pw-red/20', text: 'text-pw-red', dot: 'bg-pw-red' },
  deurwaarder: { bg: 'bg-red-100', border: 'border-[#991B1B]/20', text: 'text-[#991B1B]', dot: 'bg-[#991B1B]' },
};

interface EscalationInfoProps {
  stage: EscalationStage;
  amountCents: number;
  language: string;
}

export default function EscalationInfo({ stage, amountCents, language }: EscalationInfoProps) {
  const t = useTranslations('incasso');
  const tEsc = useTranslations('escalation');

  const stageInfo = getStageDescription(stage, language);
  const wikCosts = calculateWIKCosts(amountCents);
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.factuur;
  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="space-y-3">
      {/* Stage timeline */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <h3 className="mb-3 text-[14px] font-bold text-pw-navy">{t('stageTimeline')}</h3>
        <div className="flex items-center justify-between">
          {STAGE_ORDER.map((s, i) => {
            const isActive = i <= currentIndex;
            const isCurrent = s === stage;
            const sColors = STAGE_COLORS[s];

            return (
              <div key={s} className="flex flex-col items-center">
                {/* Dot */}
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isCurrent
                      ? `${sColors.dot} ring-2 ring-offset-2 ${sColors.text.replace('text-', 'ring-')}`
                      : isActive
                      ? sColors.dot
                      : 'bg-pw-border'
                  }`}
                >
                  {isCurrent && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={`mt-1.5 text-[9px] font-semibold ${
                    isActive ? sColors.text : 'text-pw-muted'
                  }`}
                >
                  {tEsc(s)}
                </span>
              </div>
            );
          })}
        </div>
        {/* Connecting line */}
        <div className="relative -mt-[34px] mx-3 flex h-0.5">
          {STAGE_ORDER.slice(0, -1).map((_, i) => (
            <div
              key={i}
              className={`flex-1 ${
                i < currentIndex ? STAGE_COLORS[STAGE_ORDER[i]].dot : 'bg-pw-border'
              }`}
            />
          ))}
        </div>
        <div className="h-[26px]" /> {/* Spacer for labels */}
      </div>

      {/* Stage explanation */}
      <div className={`rounded-card border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-start gap-3">
          <Info className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colors.text}`} strokeWidth={1.5} />
          <div>
            <p className={`text-[13px] font-semibold ${colors.text}`}>
              {tEsc(stage)}
            </p>
            <p className="mt-1 text-[12px] text-pw-text">{stageInfo.meaning}</p>
            <p className="mt-2 text-[12px] font-semibold text-pw-text">
              {t('recommendedAction')}: {stageInfo.action}
            </p>
          </div>
        </div>
      </div>

      {/* WIK cost estimate (only for aanmaning+) */}
      {currentIndex >= 2 && amountCents > 0 && (
        <div className="rounded-card border border-pw-red/20 bg-red-50/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-semibold text-pw-red">{t('wikTitle')}</p>
              <p className="mt-1 text-[12px] text-pw-muted">{t('wikDescription')}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[20px] font-extrabold text-pw-red">
                  {formatCents(wikCosts)}
                </span>
                <span className="text-[11px] text-pw-muted">{t('wikExtra')}</span>
              </div>
              <p className="mt-2 text-[10px] text-pw-muted">{t('wikDisclaimer')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Savings indicator (for factuur/herinnering — motivate on-time payment) */}
      {currentIndex < 2 && amountCents > 0 && (
        <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-green" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-semibold text-pw-green">{t('savingsTitle')}</p>
              <p className="mt-1 text-[12px] text-pw-muted">
                {t('savingsDescription', { amount: formatCents(calculateWIKCosts(amountCents)) })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Legal help links */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <p className="mb-2 text-[12px] font-semibold text-pw-navy">{t('helpTitle')}</p>
        <div className="space-y-2">
          <HelpLink
            label="Juridisch Loket"
            description={t('juridischLoket')}
            url="https://www.juridischloket.nl"
          />
          <HelpLink
            label="Nibud"
            description={t('nibud')}
            url="https://www.nibud.nl"
          />
          <HelpLink
            label="Schuldhulpverlening"
            description={t('schuldhulp')}
            url="https://www.rijksoverheid.nl/onderwerpen/schulden/schuldhulpverlening"
          />
        </div>
      </div>

      {/* Legal disclaimer */}
      <p className="text-center text-[10px] text-pw-muted">
        {t('legalDisclaimer')}
      </p>
    </div>
  );
}

function HelpLink({ label, description, url }: { label: string; description: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-input px-2 py-1.5 transition-colors hover:bg-pw-bg"
    >
      <div className="flex-1">
        <p className="text-[12px] font-semibold text-pw-blue">{label}</p>
        <p className="text-[10px] text-pw-muted">{description}</p>
      </div>
      <ExternalLink className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
    </a>
  );
}
