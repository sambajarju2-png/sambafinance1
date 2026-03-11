'use client'

import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import PlaceholderView from '@/components/views/PlaceholderView'
import { MOCK_BILLS } from '@/lib/mock-data'

export default function Home() {
  const openBillCount = MOCK_BILLS.filter((b) => b.status !== 'settled').length

  return (
    <AppShell billCount={openBillCount}>
      {({ activeView }) => {
        switch (activeView) {
          case 'dashboard':
            return <DashboardView />
          case 'betalingen':
            return (
              <PlaceholderView
                title="Betalingen"
                description="Het betalingenoverzicht met filters, bulk acties en detail-drawer wordt binnenkort gebouwd."
              />
            )
          case 'statistieken':
            return (
              <PlaceholderView
                title="Statistieken"
                description="Analyse van je betalingsgedrag, categorieën en gemiddelde betaaltermijnen."
              />
            )
          case 'cashflow':
            return (
              <PlaceholderView
                title="Cashflow"
                description="6-maands cashflow voorspelling met terugkerende vaste lasten."
              />
            )
          case 'instellingen':
            return (
              <PlaceholderView
                title="Instellingen"
                description="Email accounts, budgetbeheer, notificaties en sync-instellingen."
              />
            )
          default:
            return <DashboardView />
        }
      }}
    </AppShell>
  )
}
