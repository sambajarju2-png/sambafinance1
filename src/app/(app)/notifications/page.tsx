'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Clock, Trophy, ChevronRight } from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface NotifItem {
  type: 'overdue' | 'upcoming' | 'achievement';
  data: Record<string, unknown>;
}

export default function NotificationsPage() {
  const t = useTranslations('nav');
  const tNotif = useTranslations('notifications');
  const router = useRouter();
  const messages = useMessages();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Build achievement name lookup from translations
  const achItems = (messages as Record<string, unknown>)?.achievements &&
    typeof (messages as Record<string, unknown>).achievements === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).achievements?.items as Record<string, { name: string; desc: string }>) || {}
    : {};

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) { const data = await res.json(); setItems(data.items || []); }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const overdue = items.filter((i) => i.type === 'overdue');
  const upcoming = items.filter((i) => i.type === 'upcoming');
  const achievements = items.filter((i) => i.type === 'achievement');

  function getAchievementName(key: string): string {
    return achItems[key]?.name || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-pw-navy" strokeWidth={1.5} />
        <h1 className="text-heading text-pw-navy">{t('notifications')}</h1>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-[68px] rounded-card" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="mb-3 h-10 w-10 text-pw-muted/30" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-pw-text">{tNotif('noNotifications') || 'Geen meldingen'}</p>
          <p className="mt-1 text-[12px] text-pw-muted">{tNotif('allGood') || 'Alles is op orde!'}</p>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <Section title={tNotif('overdueSection') || 'Achterstallig'} count={overdue.length} color="text-pw-red">
              {overdue.map((item, i) => {
                const d = item.data as { vendor: string; amount: number; due_date: string };
                return (
                  <NotifCard key={i} icon={AlertTriangle} iconColor="text-pw-red" bgColor="bg-red-50/50" borderColor="border-pw-red/20"
                    title={d.vendor} subtitle={new Date(d.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} right={formatCents(d.amount)}
                    onClick={() => router.push('/betalingen')} />
                );
              })}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title={tNotif('upcomingSection') || 'Binnenkort'} count={upcoming.length} color="text-amber-600">
              {upcoming.map((item, i) => {
                const d = item.data as { vendor: string; amount: number; due_date: string };
                return (
                  <NotifCard key={i} icon={Clock} iconColor="text-amber-600" bgColor="bg-amber-50/50" borderColor="border-amber-500/20"
                    title={d.vendor} subtitle={new Date(d.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} right={formatCents(d.amount)}
                    onClick={() => router.push('/betalingen')} />
                );
              })}
            </Section>
          )}

          {achievements.length > 0 && (
            <Section title={tNotif('achievementsSection') || 'Prestaties'} count={achievements.length} color="text-amber-500">
              {achievements.map((item, i) => {
                const d = item.data as { achievement: string; unlocked_at: string };
                return (
                  <NotifCard key={i} icon={Trophy} iconColor="text-amber-500" bgColor="bg-amber-50/30" borderColor="border-amber-400/20"
                    title={getAchievementName(d.achievement)}
                    subtitle={new Date(d.unlocked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    onClick={() => router.push('/instellingen?tab=achievements')} />
                );
              })}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className={`text-[13px] font-bold ${color}`}>{title}</p>
        <span className="rounded-full bg-pw-border/50 px-1.5 py-0.5 text-[10px] font-bold text-pw-muted">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function NotifCard({ icon: Icon, iconColor, bgColor, borderColor, title, subtitle, right, onClick }: {
  icon: React.ElementType; iconColor: string; bgColor: string; borderColor: string;
  title: string; subtitle: string; right?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`btn-press flex w-full items-center gap-3 rounded-card border ${borderColor} ${bgColor} px-3.5 py-3 text-left`}>
      <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-pw-text truncate">{title}</p>
        <p className="text-[10px] text-pw-muted">{subtitle}</p>
      </div>
      {right && <p className="text-[13px] font-bold text-pw-text">{right}</p>}
      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
    </button>
  );
}
