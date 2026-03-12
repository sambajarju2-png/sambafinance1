'use client'

import { useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import StatistiekenView from '@/components/views/StatistiekenView'
import CashflowView from '@/components/views/CashflowView'
import InstellingenView from '@/components/views/InstellingenView'
import OnboardingPanel from '@/components/views/OnboardingPanel'
import BetalingenView from '@/components/betalingen/BetalingenView'
import LoginPage from '@/app/login/page'
import { useAuth } from '@/lib/auth-context'
import { useBills } from '@/lib/hooks/use-bills'
import { dbBillToDisplay } from '@/lib/bill-utils'
import { Database, Loader2 } from 'lucide-react'

export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const accessToken = session?.access_token ?? null
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Gebruiker'
  const userEmail = user?.email || ''
  const [onboardingDone, setOnboardingDone] = useState(false)

  const {
    bills, paidBills, loading, error, seeded,
    markPaid, undoPaid, bulkMarkPaid, updateBill, seed, refetch,
  } = useBills(accessToken)

  const displayBills = useMemo(() => bills.map(dbBillToDisplay), [bills])
  const displayPaid = useMemo(() => paidBills.map(dbBillToDisplay), [paidBills])

  if (authLoading) {
    return <div className="min-h-dvh bg-bg flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-blue animate-spin" /></div>
  }

  if (!user) return <LoginPage />

  return (
    <AppShell billCount={bills.length} bills={displayBills} userName={userName} userEmail={userEmail} onSignOut={signOut}>
      {({ activeView, household, searchQuery, settingsTab, onNavigate }) => {
        if (loading) {
          return <div className="flex flex-col items-center justify-center py-24"><Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" /><span className="text-[13px] text-muted">Laden...</span></div>
        }

        if (error && !seeded) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 rounded-xl bg-status-amber-pale flex items-center justify-center mb-4"><Database className="w-7 h-7 text-status-amber" /></div>
              <h2 className="text-[16px] font-bold text-navy mb-2">Database niet verbonden</h2>
              <p className="text-[13px] text-muted max-w-[360px] mb-4">Voeg de Supabase omgevingsvariabelen toe aan je Vercel project.</p>
              <div className="bg-bg border border-border rounded-lg p-4 text-left text-[12px] text-muted font-mono max-w-[400px] mb-4">NEXT_PUBLIC_SUPABASE_URL=...<br />NEXT_PUBLIC_SUPABASE_ANON_KEY=...<br />SUPABASE_SERVICE_ROLE_KEY=...</div>
              <p className="text-[12px] text-muted-light">Fout: {error}</p>
            </div>
          )
        }

        if (!seeded && !loading && !onboardingDone) {
          return (
            <OnboardingPanel accessToken={accessToken || ''} onComplete={async () => { setOnboardingDone(true); await refetch() }} />
          )
        }

        switch (activeView) {
          case 'dashboard':
            return <DashboardView bills={displayBills} paidBills={displayPaid} accessToken={accessToken || undefined} onNavigate={onNavigate} />
          case 'betalingen':
            return <BetalingenView bills={displayBills} paidBills={displayPaid} household={household} searchQuery={searchQuery} onMarkPaid={markPaid} onUndoPaid={undoPaid} onBulkMarkPaid={bulkMarkPaid} onUpdateBill={updateBill} accessToken={accessToken || undefined} />
          case 'statistieken':
            return <StatistiekenView bills={displayBills} />
          case 'cashflow':
            return <CashflowView bills={displayBills} />
          case 'instellingen':
            return <InstellingenView onSignOut={signOut} userName={userName} userEmail={userEmail} accessToken={accessToken || ''} onRefetch={refetch} initialTab={settingsTab || undefined} />
          default:
            return <DashboardView bills={displayBills} paidBills={displayPaid} accessToken={accessToken || undefined} onNavigate={onNavigate} />
        }
      }}
    </AppShell>
  )
}
