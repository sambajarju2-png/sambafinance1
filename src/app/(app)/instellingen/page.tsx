'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTranslations, useMessages } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, BellRing, Wallet, HelpCircle, LogOut, ChevronRight, Loader2, Trophy, Trash2, AlertTriangle, Check } from 'lucide-react';
import GmailSettings from './gmail-settings';
import GemeenteSelector from '@/components/gemeente-selector';
import DarkModeToggle from '@/components/dark-mode-toggle';
import PushPermission from '@/components/push-permission';
import TestNotification from '@/components/test-notification';
import TestEmailButtons from '@/components/test-email-buttons';
import AchievementsDisplay from '@/components/achievements';
import LanguageSwitcher from '@/components/language-switcher';
import ProfileEditor from '@/components/profile-editor';
import NotificationPreferences from '@/components/notification-preferences';
import HelpResources from '@/components/help-resources';
import TrustBadges from '@/components/trust-badges';
import AdminTestPanel from '@/components/admin-test-panel';

type SettingsTab = 'menu' | 'gmail' | 'profile' | 'notifications' | 'achievements' | 'budget' | 'help';

function SettingsContent() {
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>('menu');
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Read ?tab=gmail (or other tabs) from URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['gmail', 'profile', 'notifications', 'achievements', 'budget', 'help'].includes(tab)) {
      setActiveTab(tab as SettingsTab);
      // Clean URL
      window.history.replaceState(null, '', '/instellingen');
    }
  }, [searchParams]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/auth/login');
        router.refresh();
      }
    } catch { /* silent */ }
    finally { setDeleting(false); }
  }

  if (activeTab === 'gmail') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <Suspense fallback={<div className="skeleton h-[200px] rounded-card" />}>
          <GmailSettings />
        </Suspense>
      </div>
    );
  }

  if (activeTab === 'profile') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <h2 className="text-heading text-pw-navy">{t('profile')}</h2>
        <ProfileEditor />
        <LanguageSwitcher />
        <DarkModeToggle />
        <GemeenteSelector />
      </div>
    );
  }

  if (activeTab === 'notifications') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <h2 className="text-heading text-pw-navy">{t('notifications')}</h2>
        <NotificationPreferences />
        <PushPermission />
        <TestNotification />
        <TestEmailButtons />
        <AdminTestPanel />
      </div>
    );
  }

  if (activeTab === 'achievements') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <AchievementsDisplay />
      </div>
    );
  }

  if (activeTab === 'budget') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <h2 className="text-heading text-pw-navy">{t('budget')}</h2>
        <BudgetThresholds />
      </div>
    );
  }

  if (activeTab === 'help') {
    return (
      <div className="space-y-4">
        <BackButton onClick={() => setActiveTab('menu')} label={t('back')} />
        <h2 className="text-heading text-pw-navy">{t('debtHelp')}</h2>
        <HelpResources />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-heading text-pw-navy">{t('title')}</h1>
      <div className="space-y-2">
        <SettingsLink icon={User} label={t('profile')} description={t('profileDesc')} onClick={() => setActiveTab('profile')} />
        <SettingsLink icon={Mail} label={t('gmailAccounts')} description={t('gmailAccountsDesc')} onClick={() => setActiveTab('gmail')} />
        <SettingsLink icon={BellRing} label={t('notifications')} description={t('notificationsDesc')} onClick={() => setActiveTab('notifications')} />
        <SettingsLink icon={Trophy} label={t('achievements')} description={t('achievementsDesc')} onClick={() => setActiveTab('achievements')} />
        <SettingsLink icon={Wallet} label={t('budget')} description={t('budgetDesc')} onClick={() => setActiveTab('budget')} />
        <SettingsLink icon={HelpCircle} label={t('debtHelp')} description={t('debtHelpDesc')} onClick={() => setActiveTab('help')} />
      </div>

      <div className="pt-4 space-y-3">
        <button onClick={handleSignOut} disabled={signingOut}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-red transition-colors hover:border-pw-red/30 hover:bg-red-50 disabled:opacity-50">
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <LogOut className="h-4 w-4" strokeWidth={1.5} />}
          {tAuth('signOut')}
        </button>

        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex w-full items-center justify-center gap-2 text-[11px] text-pw-muted hover:text-pw-red transition-colors">
            <Trash2 className="h-3 w-3" strokeWidth={1.5} />
            {t('deleteAccount')}
          </button>
        ) : (
          <div className="rounded-card border-2 border-pw-red/30 bg-red-50/50 p-4 space-y-3">
            <p className="text-[12px] text-pw-text leading-relaxed">{t('deleteAccountConfirm')}</p>
            <div className="flex gap-2">
              <button onClick={handleDeleteAccount} disabled={deleting}
                className="btn-press flex-1 flex items-center justify-center gap-2 rounded-button bg-pw-red px-3 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                {t('deleteAccountButton')}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="btn-press flex-1 rounded-button border border-pw-border bg-pw-surface px-3 py-2.5 text-[12px] font-semibold text-pw-muted">
                {t('back')}
              </button>
            </div>
          </div>
        )}
      </div>

      <TrustBadges compact />
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function InstellingenPage() {
  return (
    <Suspense fallback={<div className="skeleton h-[400px] rounded-card" />}>
      <SettingsContent />
    </Suspense>
  );
}

/* ============================================================
   BUDGET THRESHOLDS — set max monthly budget + per-category warnings
   ============================================================ */
function BudgetThresholds() {
  const t = useTranslations('settings');
  const messages = useMessages();
  const catMap = (messages as Record<string, unknown>)?.addBill && typeof (messages as Record<string, unknown>).addBill === 'object'
    ? ((messages as Record<string, Record<string, unknown>>).addBill.categories as Record<string, string>) || {}
    : {};

  const [budget, setBudget] = useState('');
  const [maxBills, setMaxBills] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bills, setBills] = useState<Array<{ category: string; amount: number; status: string }>>([]);

  useEffect(() => {
    fetch('/api/settings/profile').then((r) => r.json()).then((d) => {
      if (d.profile?.monthly_budget_cents) setBudget(String(d.profile.monthly_budget_cents / 100));
      if (d.profile?.budgets?.max_open_bills) setMaxBills(String(d.profile.budgets.max_open_bills));
    }).catch(() => {});
    fetch('/api/bills').then((r) => r.json()).then((d) => setBills(d.bills || [])).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    const cents = Math.round(parseFloat(budget.replace(',', '.') || '0') * 100);
    const maxOpen = parseInt(maxBills) || 0;
    try {
      await fetch('/api/settings/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_budget_cents: cents, budgets: { max_open_bills: maxOpen } }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  // Calculate category breakdown
  const outstanding = bills.filter((b) => b.status !== 'settled');
  const categoryTotals: Record<string, { count: number; cents: number }> = {};
  for (const bill of outstanding) {
    if (!categoryTotals[bill.category]) categoryTotals[bill.category] = { count: 0, cents: 0 };
    categoryTotals[bill.category].count += 1;
    categoryTotals[bill.category].cents += bill.amount;
  }

  const budgetCents = Math.round(parseFloat(budget.replace(',', '.') || '0') * 100);
  const totalOutstanding = outstanding.reduce((s, b) => s + b.amount, 0);
  const overBudget = budgetCents > 0 && totalOutstanding > budgetCents;

  return (
    <div className="space-y-4">
      {/* Monthly budget */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <Wallet className="h-4 w-4 text-pw-blue mb-2" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-pw-text mb-1">{t('monthlyBudget')}</p>
        <p className="text-[11px] text-pw-muted mb-3">{t('monthlyBudgetDesc')}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('monthlyBudget')}</label>
            <div className="flex gap-2">
              <input type="text" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0,00"
                className="flex-1 rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
              <span className="flex items-center text-[13px] text-pw-muted">EUR</span>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-pw-muted">{t('maxOpenBills')}</label>
            <input type="number" inputMode="numeric" value={maxBills} onChange={(e) => setMaxBills(e.target.value)} placeholder="10"
              className="w-full rounded-input border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text focus:border-pw-blue focus:outline-none" />
            <p className="mt-1 text-[10px] text-pw-muted">{t('maxOpenBillsDesc')}</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="btn-press flex items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : saved ? <Check className="h-3 w-3" strokeWidth={2} /> : null}
            {saved ? t('saved') : t('save')}
          </button>
        </div>
      </div>

      {/* Budget warning */}
      {overBudget && (
        <div className="rounded-card border-2 border-pw-red/20 bg-red-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={2} />
            <p className="text-[13px] font-bold text-pw-red">{t('overBudgetWarning')}</p>
          </div>
          <p className="text-[12px] text-pw-muted">
            {t('overBudgetDesc', { total: `€${(totalOutstanding / 100).toFixed(2)}`, budget: `€${budget}` })}
          </p>
        </div>
      )}

      {/* Category breakdown */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-4">
          <p className="text-[13px] font-semibold text-pw-text mb-3">{t('categoryBreakdown')}</p>
          <div className="space-y-2">
            {Object.entries(categoryTotals)
              .sort(([, a], [, b]) => b.cents - a.cents)
              .map(([cat, data]) => (
                <div key={cat} className="flex items-center justify-between rounded-input bg-pw-bg px-3 py-2">
                  <div>
                    <p className="text-[12px] font-semibold text-pw-text">{catMap[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}</p>
                    <p className="text-[10px] text-pw-muted">{data.count} {data.count === 1 ? 'rekening' : 'rekeningen'}</p>
                  </div>
                  <p className="text-[13px] font-bold text-pw-navy">€{(data.cents / 100).toFixed(2)}</p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[13px] font-semibold text-pw-blue">
      <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={1.5} /> {label}
    </button>
  );
}

function SettingsLink({ icon: Icon, label, description, onClick }: { icon: React.ElementType; label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-4 py-3.5 text-left transition-colors hover:bg-pw-bg">
      <div className="flex h-9 w-9 items-center justify-center rounded-input bg-pw-bg"><Icon className="h-4 w-4 text-pw-muted" strokeWidth={1.5} /></div>
      <div className="flex-1"><p className="text-[14px] font-semibold text-pw-text">{label}</p><p className="text-[11px] text-pw-muted">{description}</p></div>
      <ChevronRight className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
    </button>
  );
}
