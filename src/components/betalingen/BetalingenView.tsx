'use client'
import { useState, useMemo, useCallback } from 'react'
import FilterBar, { type StatusTab, type UrgencyTab, type SortOption } from './FilterBar'
import BulkBar from './BulkBar'
import BillTable from './BillTable'
import BillDrawer from './BillDrawer'
import type { DisplayBill } from '@/lib/bill-utils'
import type { DbBill } from '@/lib/types'
interface BetalingenViewProps { bills: DisplayBill[]; paidBills: DisplayBill[]; household: string; searchQuery: string; onMarkPaid: (id: string) => Promise<void>; onUndoPaid: (id: string) => Promise<void>; onBulkMarkPaid: (ids: string[]) => Promise<void>; onUpdateBill: (id: string, updates: Partial<DbBill>) => Promise<void>; accessToken?: string }
export default function BetalingenView({ bills, paidBills, household, searchQuery, onMarkPaid, onUndoPaid, onBulkMarkPaid, onUpdateBill, accessToken }: BetalingenViewProps) {
  const [statusTab, setStatusTab] = useState<StatusTab>('open')
  const [urgencyTab, setUrgencyTab] = useState<UrgencyTab>('all')
  const [sortOption, setSortOption] = useState<SortOption>('urgency')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerBill, setDrawerBill] = useState<DisplayBill | null>(null)
  const filteredBills = useMemo(() => {
    let data: DisplayBill[]
    if (statusTab==='paid') data = [...paidBills]; else if (statusTab==='archive') data = []; else {
      data = [...bills]
      if (household !== 'joint') { const ownerKey = household === 'mine' ? 'mine' : 'partner'; data = data.filter(b => b.assignedTo === ownerKey || b.assignedTo === 'joint') }
      if (urgencyTab !== 'all') data = data.filter(b => b.urgency === urgencyTab)
    }
    if (searchQuery) { const q = searchQuery.toLowerCase(); data = data.filter(b => (b.vendor+b.description+b.category+b.reference+(b.iban||'')+(b.amount||'')).toLowerCase().includes(q)) }
    switch (sortOption) {
      case 'amount-desc': data.sort((a,b)=>(b.amount??0)-(a.amount??0)); break
      case 'amount-asc': data.sort((a,b)=>(a.amount??0)-(b.amount??0)); break
      case 'deadline': data.sort((a,b)=>new Date(a.dueDate||'2099-01-01').getTime()-new Date(b.dueDate||'2099-01-01').getTime()); break
      case 'sender': data.sort((a,b)=>a.vendor.localeCompare(b.vendor)); break
      default: const o:{[k:string]:number}={critical:0,warn:1,info:2}; data.sort((a,b)=>(o[a.urgency]??3)-(o[b.urgency]??3))
    }
    return data
  }, [bills,paidBills,statusTab,urgencyTab,sortOption,household,searchQuery])
  const counts = useMemo(() => ({open:bills.length,paid:paidBills.length,critical:bills.filter(b=>b.urgency==='critical').length,warn:bills.filter(b=>b.urgency==='warn').length,info:bills.filter(b=>b.urgency==='info').length}), [bills,paidBills])
  const handleToggleSelect = useCallback((id:string)=>{ setSelectedIds(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n}) },[])
  const handleToggleSelectAll = useCallback(()=>{ if(selectedIds.size===filteredBills.length)setSelectedIds(new Set());else setSelectedIds(new Set(filteredBills.map(b=>b.id))) },[filteredBills,selectedIds.size])
  const handleMarkPaid = useCallback(async(id:string)=>{ await onMarkPaid(id); setSelectedIds(prev=>{const n=new Set(prev);n.delete(id);return n}); if(drawerBill?.id===id)setDrawerBill(null) },[onMarkPaid,drawerBill])
  const handleBulkMarkPaid = useCallback(async()=>{ await onBulkMarkPaid(Array.from(selectedIds)); setSelectedIds(new Set()) },[selectedIds,onBulkMarkPaid])
  return (
    <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
      <FilterBar statusTab={statusTab} urgencyTab={urgencyTab} sortOption={sortOption} counts={counts} onStatusChange={setStatusTab} onUrgencyChange={setUrgencyTab} onSortChange={setSortOption}/>
      <BulkBar count={selectedIds.size} onMarkPaid={handleBulkMarkPaid} onDeselect={()=>setSelectedIds(new Set())}/>
      <BillTable bills={filteredBills} selectedIds={selectedIds} onToggleSelect={handleToggleSelect} onToggleSelectAll={handleToggleSelectAll} onMarkPaid={handleMarkPaid} onOpenDrawer={setDrawerBill} allSelected={selectedIds.size===filteredBills.length&&filteredBills.length>0}/>
      <BillDrawer bill={drawerBill} onClose={()=>setDrawerBill(null)} onMarkPaid={handleMarkPaid} onUndoPaid={async id=>{await onUndoPaid(id);setDrawerBill(null)}} onUpdateBill={onUpdateBill} accessToken={accessToken}/>
    </div>
  )
}
