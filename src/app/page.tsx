'use client'

import { useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import BetalingenView from '@/components/betalingen/BetalingenView'
import PlaceholderView from '@/components/views/PlaceholderView'
import { MOCK_BILLS, MOCK_PAID, type MockBill } from '@/lib/mock-data'

export default function Home() {
  const [bills, setBills] = useState<MockBill[]>([...MOCK_BILLS])
  const [paidBills, setPaidBills] = useState<MockBill[]>([...MOCK_PAID])

  const openBillCount = bills.filter((b) => b.status !== 'settled').length

  const handleBillsChange = useCallback((newBills: MockBill[], newPaid: MockBill[]) => {
    setBills(newBills)
    setPaidBills(newPaid)
  }, [])

  return (
    <AppShell billCount={openBillCount}>
      {({ activeView, household, searchQuery }) => {
        switch (activeView) {
          case 'dashboard':
            return <DashboardView />
          case 'betalingen':
            return (
              <BetalingenView
                bills={bills}
                paidBills={paidBills}
                household={household}
                searchQuery={searchQuery}
                onBillsChange={handleBillsChange}
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
