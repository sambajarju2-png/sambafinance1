'use client'

import { useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import DashboardView from '@/components/views/DashboardView'
import StatistiekenView from '@/components/views/StatistiekenView'
import CashflowView from '@/components/views/CashflowView'
import InstellingenView from '@/components/views/InstellingenView'
import BetalingenView from '@/components/betalingen/BetalingenView'
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
            return <StatistiekenView />
          case 'cashflow':
            return <CashflowView />
          case 'instellingen':
            return <InstellingenView />
          default:
            return <DashboardView />
        }
      }}
    </AppShell>
  )
}
