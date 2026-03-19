'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FlaskConical, Play, Check } from 'lucide-react';

const ADMIN_EMAILS = ['sambajarju@gmail.com', 'reiskenners@gmail.com'];

export default function AdminTestPanel() {
  const t = useTranslations('adminTest');
  const [isAdmin, setIsAdmin] = useState(false);
  const [triggered, setTriggered] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.ok) {
          const { profile } = await res.json();
          if (profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase())) {
            setIsAdmin(true);
          }
        }
      } catch { /* silent */ }
    }
    checkAdmin();
  }, []);

  if (!isAdmin) return null;

  function trigger(name: string) {
    // Clear localStorage flags so the popup/drawer can appear
    if (name === 'tour') {
      localStorage.removeItem('paywatch-tour-seen');
      window.dispatchEvent(new Event('paywatch-trigger-tour'));
    } else if (name === 'feedback') {
      localStorage.removeItem('paywatch-feedback');
      window.dispatchEvent(new Event('paywatch-trigger-feedback'));
    } else if (name === 'pwa') {
      localStorage.removeItem('pwa-drawer-dismissed');
      window.dispatchEvent(new Event('paywatch-trigger-pwa'));
    }

    setTriggered(name);
    setTimeout(() => setTriggered(null), 1500);
  }

  const buttons = [
    { key: 'tour', label: t('triggerTour'), confirmLabel: t('tourReset') },
    { key: 'feedback', label: t('triggerFeedback'), confirmLabel: t('feedbackReset') },
    { key: 'pwa', label: t('triggerPwa'), confirmLabel: t('pwaReset') },
  ];

  return (
    <div className="rounded-card border-2 border-dashed border-pw-purple/30 bg-pw-purple/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="h-4 w-4 text-pw-purple" strokeWidth={1.5} />
        <p className="text-[13px] font-semibold text-pw-purple">{t('title')}</p>
      </div>
      <div className="space-y-2">
        {buttons.map((btn) => (
          <button key={btn.key} onClick={() => trigger(btn.key)}
            className="btn-press flex w-full items-center gap-3 rounded-input border border-pw-border bg-pw-surface px-3 py-2.5 text-left transition-colors hover:bg-pw-bg">
            {triggered === btn.key
              ? <Check className="h-3.5 w-3.5 text-pw-green" strokeWidth={2} />
              : <Play className="h-3.5 w-3.5 text-pw-purple" strokeWidth={2} />}
            <span className="text-[12px] font-semibold text-pw-text">
              {triggered === btn.key ? btn.confirmLabel : btn.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
