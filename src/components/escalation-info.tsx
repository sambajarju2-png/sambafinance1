'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Info, AlertTriangle, Shield, ExternalLink, MapPin } from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { calculateWIKCosts, getStageDescription } from '@/lib/wik';

type EscalationStage = 'factuur' | 'herinnering' | 'aanmaning' | 'incasso' | 'deurwaarder';

const STAGE_ORDER: EscalationStage[] = ['factuur', 'herinnering', 'aanmaning', 'incasso', 'deurwaarder'];

const STAGE_COLORS: Record<EscalationStage, { dot: string; bg: string; border: string; text: string }> = {
  factuur: { dot: 'bg-pw-blue', bg: 'bg-blue-50/50', border: 'border-pw-blue/20', text: 'text-pw-blue' },
  herinnering: { dot: 'bg-amber-500', bg: 'bg-amber-50/50', border: 'border-amber-500/20', text: 'text-amber-600' },
  aanmaning: { dot: 'bg-orange-500', bg: 'bg-orange-50/50', border: 'border-orange-500/20', text: 'text-orange-600' },
  incasso: { dot: 'bg-pw-red', bg: 'bg-red-50/50', border: 'border-pw-red/20', text: 'text-pw-red' },
  deurwaarder: { dot: 'bg-red-900', bg: 'bg-red-50/50', border: 'border-red-900/20', text: 'text-red-900' },
};

interface GemeenteLink {
  gemeente: string;
  official_url: string;
  organisation_name: string;
  organisation_url: string;
  organisation_type: string;
  coverage_note: string;
}

interface EscalationInfoProps {
  stage: string;
  amountCents: number;
  language?: string;
}

export default function EscalationInfo({ stage, amountCents, language = 'nl' }: EscalationInfoProps) {
  const t = useTranslations('incasso');
  const tEsc = useTranslations('escalation');

  const [gemeenteLinks, setGemeenteLinks] = useState<GemeenteLink[]>([]);
  const [gemeente, setGemeente] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGemeente() {
      try {
        const res = await fetch('/api/gemeente');
        if (res.ok) {
          const data = await res.json();
          setGemeente(data.gemeente);
          setGemeenteLinks(data.links || []);
        }
      } catch {
        // Silent fail
      }
    }
    fetchGemeente();
  }, []);

  const validStage = STAGE_ORDER.includes(stage as EscalationStage) ? (stage as EscalationStage) : 'factuur';
  const currentIndex = STAGE_ORDER.indexOf(validStage);
  const colors = STAGE_COLORS[validStage];
  const stageInfo = getStageDescription(validStage, language);
  const wikCosts = calculateWIKCosts(amountCents);

  return (
    <div className="space-y-4">
      {/* Stage timeline */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="flex justify-between">
          {STAGE_ORDER.map((s, i) => {
            const isActive = i === currentIndex;
            const isPast = i < currentIndex;
            const sColors = STAGE_COLORS[s];
            return (
              <div key={s} className="flex flex-col items-center" style={{ width: '18%' }}>
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  isActive ? `${sColors.dot} ring-2 ring-offset-1 ${sColors.dot.replace('bg-', 'ring-')}` :
                  isPast ? sColors.dot : 'bg-pw-border'
                }`}>
                  <div className={`h-2 w-2 rounded-full ${isActive || isPast ? 'bg-white' : 'bg-pw-muted/30'}`} />
                </div>
                <span className={`mt-1 text-center text-[9px] font-semibold leading-tight ${
                  isActive ? sColors.text : isPast ? sColors.text : 'text-pw-muted'
                }`}>
                  {tEsc(s)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage explanation */}
      <div className={`rounded-card border ${colors.border} ${colors.bg} p-4`}>
        <div className="flex items-start gap-3">
          <Info className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colors.text}`} strokeWidth={1.5} />
          <div>
            <p className={`text-[13px] font-semibold ${colors.text}`}>{tEsc(validStage)}</p>
            <p className="mt-1 text-[12px] text-pw-text">{stageInfo.meaning}</p>
            <p className="mt-2 text-[12px] font-semibold text-pw-text">
              {t('recommendedAction')}: {stageInfo.action}
            </p>
          </div>
        </div>
      </div>

      {/* WIK cost estimate (aanmaning+) */}
      {currentIndex >= 2 && amountCents > 0 && (
        <div className="rounded-card border border-pw-red/20 bg-red-50/50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-semibold text-pw-red">{t('wikTitle')}</p>
              <p className="mt-1 text-[12px] text-pw-muted">{t('wikDescription')}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[20px] font-extrabold text-pw-red">{formatCents(wikCosts)}</span>
                <span className="text-[11px] text-pw-muted">{t('wikExtra')}</span>
              </div>
              <p className="mt-2 text-[10px] text-pw-muted">{t('wikDisclaimer')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Savings motivator (factuur/herinnering) */}
      {currentIndex < 2 && amountCents > 0 && (
        <div className="rounded-card border border-pw-green/20 bg-green-50/50 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-green" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-semibold text-pw-green">{t('savingsTitle')}</p>
              <p className="mt-1 text-[12px] text-pw-muted">
                {t('savingsDescription', { amount: formatCents(wikCosts) })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gemeente-specific help links */}
      {gemeente && gemeenteLinks.length > 0 && (
        <div className="rounded-card border border-pw-purple/20 bg-purple-50/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-pw-purple" strokeWidth={1.5} />
            <p className="text-[12px] font-semibold text-pw-purple">Hulp in {gemeente}</p>
          </div>
          <div className="space-y-2">
            {gemeenteLinks.map((link, i) => (
              <div key={i} className="space-y-1.5">
                <a
                  href={link.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-input px-2 py-1.5 transition-colors hover:bg-pw-bg"
                >
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-pw-blue">Gemeente {link.gemeente}</p>
                    <p className="text-[10px] text-pw-muted">Officiële schuldhulppagina</p>
                  </div>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
                </a>
                <a
                  href={link.organisation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-input px-2 py-1.5 transition-colors hover:bg-pw-bg"
                >
                  <div className="flex-1">
                    <p className="text-[12px] font-semibold text-pw-blue">{link.organisation_name}</p>
                    <p className="text-[10px] text-pw-muted">{link.coverage_note}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No gemeente set — prompt to set it */}
      {!gemeente && (
        <div className="rounded-card border border-pw-border bg-amber-50/30 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" strokeWidth={1.5} />
            <div>
              <p className="text-[12px] font-semibold text-amber-700">Stel je gemeente in</p>
              <p className="mt-0.5 text-[11px] text-pw-muted">
                Ga naar Instellingen → Profiel om je gemeente in te stellen. Dan zie je hier hulporganisaties bij jou in de buurt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* General help links */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <p className="mb-2 text-[12px] font-semibold text-pw-navy">{t('helpTitle')}</p>
        <div className="space-y-2">
          <HelpLink label="Juridisch Loket" description={t('juridischLoket')} url="https://www.juridischloket.nl" />
          <HelpLink label="Nibud" description={t('nibud')} url="https://www.nibud.nl" />
          <HelpLink label="Schuldhulpverlening" description={t('schuldhulp')} url="https://www.rijksoverheid.nl/onderwerpen/schulden/schuldhulpverlening" />
          <HelpLink label="Geldfit (0800-8115)" description="Gratis hulplijn voor geldzorgen" url="https://0800-8115.nl" />
        </div>
      </div>

      {/* Legal disclaimer */}
      <p className="text-center text-[10px] text-pw-muted">{t('legalDisclaimer')}</p>
    </div>
  );
}

function HelpLink({ label, description, url }: { label: string; description: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-input px-2 py-1.5 transition-colors hover:bg-pw-bg">
      <div className="flex-1">
        <p className="text-[12px] font-semibold text-pw-blue">{label}</p>
        <p className="text-[10px] text-pw-muted">{description}</p>
      </div>
      <ExternalLink className="h-3 w-3 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
    </a>
  );
}
