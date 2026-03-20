'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Copy, Check, Share2, Gift, Crown } from 'lucide-react';

interface Referral {
  id: string;
  referred_email: string | null;
  status: string;
  created_at: string;
}

export default function ReferralSettings() {
  const t = useTranslations('referral');
  const [code, setCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [statsUnlocked, setStatsUnlocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/referral');
        if (res.ok) {
          const data = await res.json();
          setCode(data.referral_code || '');
          setShareUrl(data.share_url || '');
          setReferrals(data.referrals || []);
          setCompletedCount(data.completed_count || 0);
          setStatsUnlocked(data.stats_unlocked || false);
        }
      } catch {} finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'PayWatch', text: 'Probeer PayWatch — rust in je hoofd over elke rekening.', url: shareUrl }); } catch {}
    } else { handleCopy(); }
  }

  if (loading) return <div className="skeleton h-[200px] rounded-card" />;

  // Current tier
  const tier = completedCount >= 3 ? 3 : completedCount >= 2 ? 2 : completedCount >= 1 ? 1 : 0;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-pw-text">{t('title')}</p>
        </div>
        <p className="text-[12px] text-pw-muted leading-relaxed mb-4">{t('desc')}</p>

        {/* Share link */}
        {shareUrl && (
          <>
            <p className="text-[11px] font-semibold text-pw-muted mb-1.5">{t('shareLink')}</p>
            <div className="flex items-center gap-2 rounded-input border border-pw-border bg-pw-bg px-3 py-2">
              <span className="flex-1 text-[11px] font-mono text-pw-text truncate">{shareUrl}</span>
              <button onClick={handleCopy} className="flex-shrink-0 text-pw-muted hover:text-pw-blue">
                {copied ? <Check className="h-4 w-4 text-pw-green" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
              </button>
            </div>
            <button onClick={handleShare}
              className="btn-press mt-3 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white">
              <Share2 className="h-4 w-4" strokeWidth={1.5} />
              {t('shareButton')}
            </button>
          </>
        )}
      </div>

      {/* Tier progress */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <p className="text-[13px] font-semibold text-pw-text mb-3">{t('friendsReferred')}: {completedCount}</p>
        <div className="space-y-2">
          <TierRow active={tier >= 1} icon={Gift} label={t('tier1')} done={completedCount >= 1} />
          <TierRow active={tier >= 2} icon={Gift} label={t('tier2')} done={completedCount >= 2} />
          <TierRow active={tier >= 3} icon={Crown} label={t('tier3')} done={completedCount >= 3} />
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-pw-border/50">
          <div className="h-2 rounded-full bg-pw-blue transition-all duration-500"
            style={{ width: `${Math.min(100, (completedCount / 3) * 100)}%` }} />
        </div>
      </div>

      {/* Referral list */}
      {referrals.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <p className="text-[13px] font-semibold text-pw-text mb-2">Uitnodigingen</p>
          <div className="space-y-2">
            {referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between rounded-input bg-pw-bg px-3 py-2">
                <span className="text-[12px] text-pw-text truncate">{ref.referred_email || 'Via link'}</span>
                <span className={`text-[10px] font-semibold ${ref.status === 'completed' ? 'text-pw-green' : 'text-pw-amber'}`}>
                  {ref.status === 'completed' ? t('statusCompleted') : t('statusPending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TierRow({ active, icon: Icon, label, done }: { active: boolean; icon: React.ElementType; label: string; done: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-input px-3 py-2 ${active ? 'bg-pw-blue/5 border border-pw-blue/20' : 'bg-pw-bg'}`}>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full ${done ? 'bg-pw-green' : active ? 'bg-pw-blue/20' : 'bg-pw-border'}`}>
        {done ? <Check className="h-3 w-3 text-white" strokeWidth={2.5} /> : <Icon className={`h-3 w-3 ${active ? 'text-pw-blue' : 'text-pw-muted'}`} strokeWidth={1.5} />}
      </div>
      <p className={`text-[11px] ${active ? 'font-semibold text-pw-text' : 'text-pw-muted'}`}>{label}</p>
    </div>
  );
}
