'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useMessages, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Clock, Trophy, ChevronRight, Trash2, Check, Users, UserCheck } from 'lucide-react';
import { formatCents } from '@/lib/bills';
import { pick } from '@/lib/i18n-pick';

interface NotifItem {
  type: 'overdue' | 'upcoming' | 'achievement' | 'mention' | 'assisted';
  data: Record<string, unknown>;
}

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const router = useRouter();
  const messages = useMessages();
  const locale = useLocale();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);

  const achItems = (messages as Record<string, unknown>)?.achievements &&
    typeof (messages as Record<string, unknown>).achievements === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).achievements?.items as Record<string, { name: string }>) || {}
    : {};

  useEffect(() => {
    // If previously cleared this session, don't fetch
    const wasCleared = sessionStorage.getItem('pw-notif-cleared');
    if (wasCleared) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          // Mark assisted-change records as seen now that the user is viewing them.
          if ((data.assisted || 0) > 0) {
            fetch('/api/assisted-changes', { method: 'POST' }).catch(() => {});
          }
        }
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  function getAchievementName(key: string): string {
    return achItems[key]?.name || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function handleClearAll() {
    setItems([]);
    setCleared(true);
    sessionStorage.setItem('pw-notif-cleared', 'true');
    // Dispatch event so topbar resets badge to 0
    window.dispatchEvent(new CustomEvent('pw-notif-cleared'));
    // Mark all community notifications as read
    fetch('/api/community/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setTimeout(() => setCleared(false), 2000);
  }

  async function handleMentionClick(notif: Record<string, unknown>) {
    // Mark this notification as read
    if (notif.id) {
      fetch('/api/community/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      }).catch(() => {});
    }
    // Remove from local list
    setItems((prev) => prev.filter((i) => i.type !== 'mention' || (i.data as Record<string, unknown>).id !== notif.id));
    // Navigate to feed with post open
    router.push(`/feed?post=${notif.post_id}`);
  }

  const overdue = items.filter((i) => i.type === 'overdue');
  const upcoming = items.filter((i) => i.type === 'upcoming');
  const achievements = items.filter((i) => i.type === 'achievement');
  const mentions = items.filter((i) => i.type === 'mention');
  const assisted = items.filter((i) => i.type === 'assisted');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-pw-navy" strokeWidth={1.5} />
          <h1 className="text-heading text-pw-navy">{t('title')}</h1>
        </div>
        {items.length > 0 && (
          <button onClick={handleClearAll} className="flex items-center gap-1 text-[12px] font-semibold text-pw-muted hover:text-pw-red transition-colors">
            {cleared ? <Check className="h-3.5 w-3.5 text-pw-green" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {cleared ? t('cleared') : t('clearAll')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-[68px] rounded-card" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="mb-3 h-10 w-10 text-pw-muted/30" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-pw-text">{t('noNotifications')}</p>
          <p className="mt-1 text-[12px] text-pw-muted">{t('allGood')}</p>
        </div>
      ) : (
        <>
          {/* Assisted changes — data an organisation updated on the user's behalf */}
          {assisted.length > 0 && (
            <Section title={pick(locale, { nl: 'Door je organisatie', en: 'By your organisation', pl: 'Przez Twoją organizację', tr: 'Kuruluşun tarafından', fr: 'Par ton organisation', ar: 'بواسطة مؤسستك' })} count={assisted.length} color="text-pw-blue">
              {assisted.map((item, i) => {
                const d = item.data as { change_type: string; details: Record<string, unknown>; org_name: string | null };
                const c = assistedContent(locale, d);
                return (
                  <NotifCard key={i} icon={UserCheck} iconColor="text-pw-blue" bgColor="bg-blue-50/50" borderColor="border-pw-blue/20"
                    title={c.title} subtitle={c.subtitle}
                    onClick={() => router.push('/instellingen')} />
                );
              })}
            </Section>
          )}

          {/* Community mentions */}
          {mentions.length > 0 && (
            <Section title={t('mentionSection')} count={mentions.length} color="text-pw-blue">
              {mentions.map((item, i) => {
                const d = item.data as { id: string; from_display_name: string; content_preview: string; post_id: string; created_at: string };
                return (
                  <NotifCard
                    key={i}
                    icon={Users}
                    iconColor="text-pw-blue"
                    bgColor="bg-blue-50/50"
                    borderColor="border-pw-blue/20"
                    title={d.from_display_name || 'Iemand'}
                    subtitle={d.content_preview || ''}
                    onClick={() => handleMentionClick(d)}
                  />
                );
              })}
            </Section>
          )}

          {overdue.length > 0 && (
            <Section title={t('overdueSection')} count={overdue.length} color="text-pw-red">
              {overdue.map((item, i) => {
                const d = item.data as { vendor: string; amount: number; due_date: string };
                return (<NotifCard key={i} icon={AlertTriangle} iconColor="text-pw-red" bgColor="bg-red-50/50" borderColor="border-pw-red/20"
                  title={d.vendor} subtitle={new Date(d.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} right={formatCents(d.amount)}
                  onClick={() => router.push('/betalingen')} />);
              })}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title={t('upcomingSection')} count={upcoming.length} color="text-amber-600">
              {upcoming.map((item, i) => {
                const d = item.data as { vendor: string; amount: number; due_date: string };
                return (<NotifCard key={i} icon={Clock} iconColor="text-amber-600" bgColor="bg-amber-50/50" borderColor="border-amber-500/20"
                  title={d.vendor} subtitle={new Date(d.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} right={formatCents(d.amount)}
                  onClick={() => router.push('/betalingen')} />);
              })}
            </Section>
          )}
          {achievements.length > 0 && (
            <Section title={t('achievementsSection')} count={achievements.length} color="text-amber-500">
              {achievements.map((item, i) => {
                const d = item.data as { achievement: string; unlocked_at: string };
                return (<NotifCard key={i} icon={Trophy} iconColor="text-amber-500" bgColor="bg-amber-50/30" borderColor="border-amber-400/20"
                  title={getAchievementName(d.achievement)} subtitle={new Date(d.unlocked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  onClick={() => router.push('/instellingen?tab=achievements')} />);
              })}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function assistedContent(locale: string, d: { change_type: string; details: Record<string, unknown>; org_name: string | null }): { title: string; subtitle: string } {
  const org = d.org_name || pick(locale, { nl: 'Je organisatie', en: 'Your organisation', pl: 'Twoja organizacja', tr: 'Kuruluşun', fr: 'Ton organisation', ar: 'مؤسستك' });
  if (d.change_type === 'language') {
    const native: Record<string, string> = { nl: 'Nederlands', en: 'English', pl: 'Polski', tr: 'Türkçe', fr: 'Français', ar: 'العربية' };
    const code = typeof d.details?.language === 'string' ? (d.details.language as string) : '';
    const langName = native[code] || code.toUpperCase();
    return {
      title: pick(locale, { nl: 'Taal gewijzigd', en: 'Language changed', pl: 'Zmieniono język', tr: 'Dil değiştirildi', fr: 'Langue modifiée', ar: 'تم تغيير اللغة' }),
      subtitle: pick(locale, {
        nl: `${org} heeft je taal gewijzigd naar ${langName}`,
        en: `${org} changed your language to ${langName}`,
        pl: `${org} zmienił Twój język na ${langName}`,
        tr: `${org} dilini ${langName} olarak değiştirdi`,
        fr: `${org} a changé ta langue en ${langName}`,
        ar: `قام ${org} بتغيير لغتك إلى ${langName}`,
      }),
    };
  }
  return {
    title: pick(locale, { nl: 'Gegevens bijgewerkt', en: 'Details updated', pl: 'Zaktualizowano dane', tr: 'Bilgiler güncellendi', fr: 'Données mises à jour', ar: 'تم تحديث البيانات' }),
    subtitle: pick(locale, {
      nl: `${org} heeft je financiële gegevens bijgewerkt`,
      en: `${org} updated your financial details`,
      pl: `${org} zaktualizował Twoje dane finansowe`,
      tr: `${org} finansal bilgilerini güncelledi`,
      fr: `${org} a mis à jour tes données financières`,
      ar: `قام ${org} بتحديث بياناتك المالية`,
    }),
  };
}

function Section({ title, count, color, children }: { title: string; count: number; color: string; children: React.ReactNode }) {
  return (<div><div className="mb-2 flex items-center gap-2"><p className={`text-[13px] font-bold ${color}`}>{title}</p><span className="rounded-full bg-pw-border/50 px-1.5 py-0.5 text-[10px] font-bold text-pw-muted">{count}</span></div><div className="space-y-2">{children}</div></div>);
}

function NotifCard({ icon: Icon, iconColor, bgColor, borderColor, title, subtitle, right, onClick }: {
  icon: React.ElementType; iconColor: string; bgColor: string; borderColor: string; title: string; subtitle: string; right?: string; onClick: () => void | Promise<void>;
}) {
  return (<button onClick={onClick} className={`btn-press flex w-full items-center gap-3 rounded-card border ${borderColor} ${bgColor} px-3.5 py-3 text-left`}>
    <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} strokeWidth={1.5} />
    <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-pw-text truncate">{title}</p><p className="text-[10px] text-pw-muted truncate">{subtitle}</p></div>
    {right && <p className="text-[13px] font-bold text-pw-text">{right}</p>}
    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
  </button>);
}
