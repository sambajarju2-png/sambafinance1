'use client'

import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import StatistiekenView from '@/components/views/StatistiekenView'
import CashflowView from '@/components/views/CashflowView'
import InstellingenView from '@/components/views/InstellingenView'
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

  const {
    bills, paidBills, loading, error, seeded,
    markPaid, undoPaid, bulkMarkPaid, updateBill, seed,
  } = useBills(accessToken)

  const displayBills = useMemo(() => bills.map(dbBillToDisplay), [bills])
  const displayPaid = useMemo(() => paidBills.map(dbBillToDisplay), [paidBills])

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
      </div>
    )
  }

  // Not logged in — show login page
  if (!user) {
    return <LoginPage />
  }

  return (
    <AppShell billCount={bills.length} userName={userName} userEmail={userEmail} onSignOut={signOut}>
      {({ activeView, household, searchQuery }) => {
        // Loading state
        if (loading) {
          return (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" />
              <span className="text-[13px] text-muted">Laden...</span>
            </div>
          )
        }

        // Error state (env vars not configured)
        if (error && !seeded) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 rounded-xl bg-status-amber-pale flex items-center justify-center mb-4">
                <Database className="w-7 h-7 text-status-amber" />
              </div>
              <h2 className="text-[16px] font-bold text-navy mb-2">Database niet verbonden</h2>
              <p className="text-[13px] text-muted max-w-[360px] mb-4">
                Voeg de Supabase omgevingsvariabelen toe aan je Vercel project om de app te verbinden met je database.
              </p>
              <div className="bg-bg border border-border rounded-lg p-4 text-left text-[12px] text-muted font-mono max-w-[400px] mb-4">
                NEXT_PUBLIC_SUPABASE_URL=...<br />
                NEXT_PUBLIC_SUPABASE_ANON_KEY=...<br />
                SUPABASE_SERVICE_ROLE_KEY=...
              </div>
              <p className="text-[12px] text-muted-light">
                Fout: {error}
              </p>
            </div>
          )
        }

        // Seed state (connected but no data)
        if (!seeded && !loading) {
          return (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 rounded-xl bg-brand-blue-pale flex items-center justify-center mb-4">
                <Database className="w-7 h-7 text-brand-blue" />
              </div>
              <h2 className="text-[16px] font-bold text-navy mb-2">Database is leeg</h2>
              <p className="text-[13px] text-muted max-w-[360px] mb-5">
                Je database is verbonden maar bevat nog geen data. Klik hieronder om de demo-gegevens te laden.
              </p>
              <button
                onClick={seed}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light transition-colors"
              >
                <Database className="w-4 h-4" />
                Seed demo data
              </button>
            </div>
          )
        }

        // Normal views
        switch (activeView) {
          case 'dashboard':
            return <DashboardView bills={displayBills} paidBills={displayPaid} />
          case 'betalingen':
            return (
              <BetalingenView
                bills={displayBills}
                paidBills={displayPaid}
                household={household}
                searchQuery={searchQuery}
                onMarkPaid={markPaid}
                onUndoPaid={undoPaid}
                onBulkMarkPaid={bulkMarkPaid}
                onUpdateBill={updateBill}
              />
            )
          case 'statistieken':
            return <StatistiekenView bills={displayBills} />
          case 'cashflow':
            return <CashflowView bills={displayBills} />
          case 'instellingen':
            return <InstellingenView onSignOut={signOut} userName={userName} userEmail={userEmail} accessToken={accessToken || ''} />
          default:
            return <DashboardView bills={displayBills} paidBills={displayPaid} />
        }
      }}
    </AppShell>
  )
}
