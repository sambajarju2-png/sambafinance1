'use client'

import { useState, useMemo, useCallback } from 'react'
import FilterBar, { type StatusTab, type UrgencyTab, type SortOption } from './FilterBar'
import BulkBar from './BulkBar'
import BillTable from './BillTable'
import BillDrawer from './BillDrawer'
import { type MockBill, type Household } from '@/lib/mock-data'

interface BetalingenViewProps {
  bills: MockBill[]
  paidBills: MockBill[]
  household: Household
  searchQuery: string
  onBillsChange: (bills: MockBill[], paid: MockBill[]) => void
}

// Re-export Household from mock-data for page.tsx
export type { Household } from '@/lib/mock-data'

export default function BetalingenView({
  bills,
  paidBills,
  household,
  searchQuery,
  onBillsChange,
}: BetalingenViewProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>('open')
  const [urgencyTab, setUrgencyTab] = useState<UrgencyTab>('all')
  const [sortOption, setSortOption] = useState<SortOption>('urgency')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerBill, setDrawerBill] = useState<MockBill | null>(null)

  // Filter logic
  const openBills = useMemo(() => {
    return bills.filter((b) => b.status !== 'settled')
  }, [bills])

  const filteredBills = useMemo(() => {
    let data: MockBill[]

    if (statusTab === 'paid') {
      data = [...paidBills]
    } else if (statusTab === 'archive') {
      data = []
    } else {
      data = [...openBills]

      // Household filter
      if (household !== 'joint') {
        const ownerKey = household === 'mine' ? 'mine' : 'partner'
        data = data.filter((b) => b.assignedTo === ownerKey || b.assignedTo === 'joint')
      }

      // Urgency filter
      if (urgencyTab !== 'all') {
        data = data.filter((b) => b.urgency === urgencyTab)
      }
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter((b) =>
        (b.vendor + b.description + b.category + b.reference + (b.iban || '') + (b.amount || ''))
          .toLowerCase()
          .includes(q)
      )
    }

    // Sort
    switch (sortOption) {
      case 'amount-desc':
        data.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
        break
      case 'amount-asc':
        data.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))
        break
      case 'deadline':
        data.sort((a, b) =>
          new Date(a.dueDate || '2099-01-01').getTime() - new Date(b.dueDate || '2099-01-01').getTime()
        )
        break
      case 'sender':
        data.sort((a, b) => a.vendor.localeCompare(b.vendor))
        break
      default: // urgency
        const urgOrder = { critical: 0, warn: 1, info: 2 }
        data.sort((a, b) => (urgOrder[a.urgency] ?? 3) - (urgOrder[b.urgency] ?? 3))
    }

    return data
  }, [openBills, paidBills, statusTab, urgencyTab, sortOption, household, searchQuery])

  // Counts for filter badges
  const counts = useMemo(() => ({
    open: openBills.length,
    paid: paidBills.length,
    critical: openBills.filter((b) => b.urgency === 'critical').length,
    warn: openBills.filter((b) => b.urgency === 'warn').length,
    info: openBills.filter((b) => b.urgency === 'info').length,
  }), [openBills, paidBills])

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredBills.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBills.map((b) => b.id)))
    }
  }, [filteredBills, selectedIds.size])

  // Mark as paid
  const handleMarkPaid = useCallback((id: string) => {
    const bill = bills.find((b) => b.id === id)
    if (!bill) return

    const paidBill: MockBill = {
      ...bill,
      status: 'settled',
      paidAt: new Date().toISOString(),
    }

    const newBills = bills.filter((b) => b.id !== id)
    const newPaid = [paidBill, ...paidBills]
    onBillsChange(newBills, newPaid)

    // Remove from selection
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })

    // Close drawer if this bill was open
    if (drawerBill?.id === id) {
      setDrawerBill(null)
    }
  }, [bills, paidBills, onBillsChange, drawerBill])

  const handleBulkMarkPaid = useCallback(() => {
    let newBills = [...bills]
    let newPaid = [...paidBills]

    selectedIds.forEach((id) => {
      const bill = newBills.find((b) => b.id === id)
      if (bill) {
        newPaid.unshift({
          ...bill,
          status: 'settled',
          paidAt: new Date().toISOString(),
        })
        newBills = newBills.filter((b) => b.id !== id)
      }
    })

    onBillsChange(newBills, newPaid)
    setSelectedIds(new Set())
  }, [bills, paidBills, selectedIds, onBillsChange])

  const handleDeselect = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      {/* Filter bar */}
      <FilterBar
        statusTab={statusTab}
        urgencyTab={urgencyTab}
        sortOption={sortOption}
        counts={counts}
        onStatusChange={setStatusTab}
        onUrgencyChange={setUrgencyTab}
        onSortChange={setSortOption}
      />

      {/* Bulk action bar */}
      <BulkBar
        count={selectedIds.size}
        onMarkPaid={handleBulkMarkPaid}
        onDeselect={handleDeselect}
      />

      {/* Bill table */}
      <BillTable
        bills={filteredBills}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onMarkPaid={handleMarkPaid}
        onOpenDrawer={setDrawerBill}
        allSelected={selectedIds.size === filteredBills.length && filteredBills.length > 0}
      />

      {/* Detail drawer */}
      <BillDrawer
        bill={drawerBill}
        onClose={() => setDrawerBill(null)}
        onMarkPaid={handleMarkPaid}
      />
    </div>
  )
}
