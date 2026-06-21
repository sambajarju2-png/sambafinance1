'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { Phone } from 'lucide-react';

// Reuses the existing voice component; mode="checkin" swaps the token endpoint
// (/api/checkin/token) and enables the flag_for_support client tool.
const VoiceCall = dynamic(() => import('@/components/chat/voice-call'), { ssr: false });

const LABELS: Record<string, string> = {
  nl: 'Check-in starten',
  en: 'Start check-in',
  pl: 'Rozpocznij check-in',
  tr: 'Check-in başlat',
  fr: 'Démarrer le check-in',
  ar: 'ابدأ تسجيل الوصول',
};

export default function CheckinCallButton() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const label = LABELS[locale] ?? LABELS.nl;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-pw-navy px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-pw-navy/90"
      >
        <Phone className="h-4 w-4" strokeWidth={2} />
        {label}
      </button>
      {open && (
        <VoiceCall mode="checkin" lang={locale} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
