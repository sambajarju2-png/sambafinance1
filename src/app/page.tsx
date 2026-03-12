'use client'

import { useMemo, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import StatistiekenView from '@/components/views/StatistiekenView'
import CashflowView from '@/components/views/CashflowView'
import InstellingenView from '@/components/views/InstellingenView'
import BetalingenView from '@/components/betalingen/BetalingenView'
import OnboardingView from '@/components/views/OnboardingView'
import LoginPage from '@/app/login/page'
import { useAuth } from '@/lib/auth-context'
import { useBills } from '@/lib/hooks/use-bills'
import { dbBillToDisplay } from '@/lib/bill-utils'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const accessToken = session?.access_token ?? null
  const userName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : user?.user_metadata?.name || user?.email?.split('@')[0] || 'Gebruiker'
  const userEmail = user?.email || ''

  const {
    bills, paidBills, loading, error,
    markPaid, undoPaid, bulkMarkPaid, updateBill, refetch,
  } = useBills(accessToken)

  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const displayBills = useMemo(() => bills.map(dbBillToDisplay), [bills])
  const displayPaid = useMemo(() => paidBills.map(dbBillToDisplay), [paidBills])

  const hasBills = bills.length > 0 || paidBills.length > 0

  if (authLoading) {
    return <div className="min-h-dvh bg-bg flex items-center justify-center"><Loader2 className="w-8 h-8 text-brand-blue animate-spin" /></div>
  }

  if (!user) return <LoginPage />

  return (
    <AppShell billCount={bills.length} bills={displayBills} userName={userName} userEmail={userEmail} onSignOut={signOut}>
      {({ activeView, household, searchQuery }) => {
        if (loading) {
          return <div className="flex flex-col items-center justify-center py-24"><Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" /><span className="text-[13px] text-muted">Laden...</span></div>
        }

        // Show onboarding when no bills exist and user hasn't dismissed it
        if (!hasBills && !onboardingDismissed && !loading) {
          return (
            <OnboardingView
              accessToken={accessToken}
              onComplete={() => {
                setOnboardingDismissed(true)
                refetch()
              }}
              userEmail={userEmail}
            />
          )
        }

        switch (activeView) {
          case 'dashboard':
            return <DashboardView bills={displayBills} paidBills={displayPaid} accessToken={accessToken || undefined} />
          case 'betalingen':
            return <BetalingenView bills={displayBills} paidBills={displayPaid} household={household} searchQuery={searchQuery} onMarkPaid={markPaid} onUndoPaid={undoPaid} onBulkMarkPaid={bulkMarkPaid} onUpdateBill={updateBill} accessToken={accessToken || undefined} />
          case 'statistieken':
            return <StatistiekenView bills={displayBills} />
          case 'cashflow':
            return <CashflowView bills={displayBills} />
          case 'instellingen':
            return <InstellingenView onSignOut={signOut} userName={userName} userEmail={userEmail} accessToken={accessToken || ''} onRefetch={refetch} />
          default:
            return <DashboardView bills={displayBills} paidBills={displayPaid} accessToken={accessToken || undefined} />
        }
      }}
    </AppShell>
  )
}
