'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, Save, Mail, Phone, Building2, Globe, Link2, Undo2, ExternalLink } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import type { DisplayBill } from '@/lib/bill-utils'
import { formatAmount, formatDate, daysUntilDate as daysUntil } from '@/lib/bill-utils'
import type { DbBill } from '@/lib/types'

type DrawerTab = 'details' | 'reactie' | 'notitie'

interface BillDrawerProps {
  bill: DisplayBill | null
  onClose: () => void
  onMarkPaid: (id: string) => void
  onUndoPaid?: (id: string) => void
  onUpdateBill?: (id: string, updates: Partial<DbBill>) => Promise<void>
}

export default function BillDrawer({ bill, onClose, onMarkPaid, onUndoPaid, onUpdateBill }: BillDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('details')
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [emailTab, setEmailTab] = useState<'full' | 'plan'>('full')
  const [copied, setCopied] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savedNotes, setSavedNotes] = useState<{ text: string; date: string }[]>([])

  const isOpen = bill !== null

  useEffect(() => {
    if (bill) {
      setActiveTab('details')
      setEmailTab('full')
      setCopied(false)
      setNoteText('')

      // Init checklist state from DB
      const cl = bill.checklist || []
      const state: Record<number, boolean> = {}
      cl.forEach((item, i) => { state[i] = item.done })
      setCheckedItems(state)

      // Parse notes
      if (bill.notes) {
        const parsed = bill.notes.split('\n').filter(Boolean).map((line) => {
          const match = line.match(/^\[(.+?)\]\s*(.+)$/)
          return match ? { date: match[1], text: match[2] } : { date: '—', text: line }
        })
        setSavedNotes(parsed)
      } else {
        setSavedNotes([])
      }
    }
  }, [bill?.id, bill?.notes, bill?.checklist])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!bill) return null

  const days = daysUntil(bill.dueDate)
  const isPaid = bill.status === 'settled'
  const urgColor = days !== null && days <= 4 ? 'text-status-red' : days !== null && days <= 10 ? 'text-status-amber' : 'text-brand-blue'
  const checklist = bill.checklist || []
  const hasDrafts = bill.emailDrafts && (bill.emailDrafts.full || bill.emailDrafts.plan)

  function handleCopy() {
    if (!bill) return
    const text = emailTab === 'full' ? bill.emailDrafts?.full : bill.emailDrafts?.plan
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleToggleCheck(idx: number) {
    const newState = { ...checkedItems, [idx]: !checkedItems[idx] }
    setCheckedItems(newState)
    if (onUpdateBill && bill) {
      const updated = checklist.map((item, i) => ({ ...item, done: !!newState[i] }))
      await onUpdateBill(bill.id, { checklist: updated } as Partial<DbBill>)
    }
  }

  async function handleSaveNote() {
    if (!noteText.trim() || !bill) return
    const newNote = {
      text: noteText.trim(),
      date: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
    }
    const updatedNotes = [newNote, ...savedNotes]
    setSavedNotes(updatedNotes)
    setNoteText('')
    if (onUpdateBill) {
      const notesStr = updatedNotes.map((n) => `[${n.date}] ${n.text}`).join('\n')
      await onUpdateBill(bill.id, { notes: notesStr })
    }
  }

  let progressPct = 0
  if (bill.dueDate) {
    const issued = new Date(bill.receivedDate || bill.dueDate).getTime()
    const due = new Date(bill.dueDate).getTime()
    const now = new Date().getTime()
    if (due > issued) progressPct = Math.min(100, Math.max(0, ((now - issued) / (due - issued)) * 100))
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-navy/20 backdrop-blur-[3px] z-[100] transition-opacity duration-250
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-[min(600px,100vw)]
          bg-surface border-l border-border z-[200] transition-transform duration-300 ease-out
          overflow-y-auto shadow-drawer flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="px-5 md:px-6 pt-5 pb-4 border-b border-border sticky top-0 bg-surface z-10 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[16px] font-extrabold border border-black/[.06] flex-shrink-0"
              style={{ background: bill.avatarBg, color: bill.avatarFg }}
            >{bill.initials}</div>
            <div>
              <div className="text-[15.5px] font-extrabold text-navy">{bill.vendor}</div>
              <div className="text-[12px] text-muted">{bill.category} · {bill.reference}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-[7px] border border-border bg-surface text-muted flex items-center justify-center hover:bg-bg hover:text-navy transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 md:px-6 sticky top-[79px] bg-surface z-[9]">
          {(['details', 'reactie', 'notitie'] as DrawerTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-[12.5px] font-semibold border-b-2 -mb-[1px] transition-colors whitespace-nowrap capitalize
                ${activeTab === tab ? 'text-brand-blue border-brand-blue' : 'text-muted border-transparent hover:text-navy'}`}
            >
              {tab === 'details' ? 'Details' : tab === 'reactie' ? 'Reactie' : 'Notitie'}
            </button>
          ))}
        </div>

        <div className="flex-1 px-5 md:px-6 py-5">
          {/* ── DETAILS ── */}
          {activeTab === 'details' && (
            <div>
              <div className="text-[36px] font-extrabold text-navy tracking-tight leading-none mb-1.5">{formatAmount(bill.amount)}</div>
              <div className="mb-4"><StatusBadge urgency={isPaid ? 'paid' : bill.urgency} /></div>

              {/* Progress bar */}
              {bill.dueDate && !isPaid && (
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-muted mb-1.5">
                    <span>{formatDate(bill.receivedDate)}</span>
                    <span className={`font-bold ${urgColor}`}>
                      {days !== null && days <= 0 ? 'Verlopen!' : days !== null ? `${days} dagen resterend` : '—'}
                    </span>
                    <span>{formatDate(bill.dueDate)}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%`, background: days !== null && days <= 4 ? '#DC2626' : days !== null && days <= 10 ? '#D97706' : '#3B82F6' }} />
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <InfoBlock label="Deadline" value={isPaid ? formatDate(bill.paidAt) : formatDate(bill.dueDate)} />
                <InfoBlock label="Categorie" value={bill.category} />
                <InfoBlock label="Kenmerk" value={bill.reference} small copyable />
                <InfoBlock label="Account" value={bill.assignedTo === 'joint' ? 'Gezamenlijk' : bill.assignedTo === 'mine' ? 'Mijn' : 'Partner'} />
                {bill.source === 'gmail_scan' && <InfoBlock label="Bron" value="Gmail scan" />}
              </div>

              {/* Payment Details Section */}
              {(bill.iban || bill.paymentUrl) && (
                <div className="mt-5">
                  <SectionTitle>Betalingsgegevens</SectionTitle>
                  <div className="bg-bg border border-border rounded-lg overflow-hidden">
                    {bill.iban && (
                      <div className="px-3.5 py-3 border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-light mb-1">IBAN</div>
                            <div className="text-[13px] font-bold text-navy font-mono">{bill.iban}</div>
                          </div>
                          <CopyButton value={bill.iban} />
                        </div>
                      </div>
                    )}
                    {bill.reference && bill.reference !== '—' && (
                      <div className="px-3.5 py-3 border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-light mb-1">Betalingskenmerk</div>
                            <div className="text-[13px] font-bold text-navy font-mono">{bill.reference}</div>
                          </div>
                          <CopyButton value={bill.reference} />
                        </div>
                      </div>
                    )}
                    {bill.paymentUrl && (
                      <a 
                        href={bill.paymentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3.5 py-3 bg-brand-blue-pale hover:bg-brand-blue-mid transition-colors"
                      >
                        <Link2 className="w-4 h-4 text-brand-blue" />
                        <span className="text-[12.5px] font-semibold text-brand-blue flex-1">Direct betalen via link</span>
                        <ExternalLink className="w-3.5 h-3.5 text-brand-blue" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Contact info */}
              {(bill.vendorContact || bill.iban) && (
                <div className="mt-5">
                  <SectionTitle>Contact</SectionTitle>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {bill.vendorContact?.email && <ContactItem icon={<Mail className="w-3.5 h-3.5" />} value={bill.vendorContact.email} />}
                    {bill.vendorContact?.phone && <ContactItem icon={<Phone className="w-3.5 h-3.5" />} value={bill.vendorContact.phone} />}
                    {bill.vendorContact?.website && <ContactItem icon={<Globe className="w-3.5 h-3.5" />} value={bill.vendorContact.website} />}
                    {bill.iban && <ContactItem icon={<Building2 className="w-3.5 h-3.5" />} value={bill.iban} />}
                  </div>
                </div>
              )}

              {/* Checklist */}
              {checklist.length > 0 && (
                <div className="mt-5">
                  <SectionTitle>Actielijst</SectionTitle>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {checklist.map((item, i) => {
                      const done = !!checkedItems[i]
                      return (
                        <button
                          key={i}
                          onClick={() => handleToggleCheck(i)}
                          className={`w-full flex items-start gap-3 px-3.5 py-3 border-b border-border last:border-b-0 text-left transition-colors hover:bg-[#FAFCFF] ${done ? 'opacity-50' : ''}`}
                        >
                          <span className={`w-[17px] h-[17px] rounded flex items-center justify-center flex-shrink-0 mt-[1px] transition-all
                            ${done ? 'bg-brand-blue border-brand-blue' : 'border-[1.5px] border-border-strong'}`}>
                            {done && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </span>
                          <span className={`text-[13px] leading-relaxed ${done ? 'line-through text-muted' : 'text-navy'}`}>
                            {item.text}
                            {item.urgent && !done && <span className="inline-block ml-1.5 text-[9.5px] font-bold uppercase px-1.5 py-[1px] rounded bg-status-red-pale text-status-red">Urgent</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-6 flex gap-2">
                {!isPaid ? (
                  <button onClick={() => onMarkPaid(bill.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light transition-colors">
                    <Check className="w-4 h-4" /> Markeer als betaald
                  </button>
                ) : onUndoPaid ? (
                  <button onClick={() => onUndoPaid(bill.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-status-amber-mid bg-status-amber-pale text-status-amber text-[13px] font-bold hover:bg-status-amber-mid transition-colors">
                    <Undo2 className="w-4 h-4" /> Markeer als onbetaald
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* ── REACTIE ── */}
          {activeTab === 'reactie' && (
            <div>
              {!hasDrafts ? (
                <p className="text-muted text-[13px]">Geen e-maildraft beschikbaar voor deze betaling.</p>
              ) : (
                <>
                  {bill.emailDrafts?.full && bill.emailDrafts?.plan && (
                    <div className="flex gap-[1px] bg-border rounded-lg overflow-hidden mb-3">
                      <button onClick={() => setEmailTab('full')}
                        className={`flex-1 py-2.5 text-[12.5px] font-bold text-center transition-colors ${emailTab === 'full' ? 'bg-surface text-navy shadow-card' : 'bg-bg text-muted'}`}>
                        Volledig betalen
                      </button>
                      <button onClick={() => setEmailTab('plan')}
                        className={`flex-1 py-2.5 text-[12.5px] font-bold text-center transition-colors ${emailTab === 'plan' ? 'bg-surface text-navy shadow-card' : 'bg-bg text-muted'}`}>
                        Betalingsregeling
                      </button>
                    </div>
                  )}
                  <div className="bg-bg border border-border rounded-lg p-3.5 text-[12.5px] leading-relaxed text-slate-600 whitespace-pre-wrap max-h-[220px] overflow-y-auto font-sans">
                    {emailTab === 'full' ? bill.emailDrafts?.full : bill.emailDrafts?.plan}
                  </div>
                  <button onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 mt-2.5 px-4 py-2 rounded-[7px] text-[12.5px] font-bold transition-colors
                      ${copied ? 'bg-status-green text-white' : 'bg-navy text-white hover:bg-navy-light'}`}>
                    {copied ? <><Check className="w-3.5 h-3.5" /> Gekopieerd!</> : <><Copy className="w-3.5 h-3.5" /> Kopieer e-mail</>}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── NOTITIE ── */}
          {activeTab === 'notitie' && (
            <div>
              <SectionTitle>Notitie toevoegen</SectionTitle>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Typ hier je notitie…"
                className="w-full min-h-[120px] border border-border rounded-lg p-3.5 text-[13px] text-txt resize-y outline-none transition-colors bg-bg focus:border-brand-blue-hover focus:bg-surface font-sans"
              />
              <button onClick={handleSaveNote}
                className="inline-flex items-center gap-1.5 mt-2.5 px-4 py-2 rounded-[7px] bg-brand-blue text-white text-[12.5px] font-bold hover:bg-brand-blue-hover transition-colors">
                <Save className="w-3.5 h-3.5" /> Notitie opslaan
              </button>
              {savedNotes.length > 0 && (
                <div className="mt-5">
                  <div className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-light mb-2.5">Eerdere notities</div>
                  <div className="space-y-2">
                    {savedNotes.map((note, i) => (
                      <div key={i} className="bg-bg border border-border rounded-lg p-3">
                        <div className="text-[13px] text-navy">{note.text}</div>
                        <div className="text-[11px] text-muted-light mt-1">{note.date}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {savedNotes.length === 0 && <p className="text-[12px] text-muted-light mt-4">Nog geen notities.</p>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[.1em] text-muted-light mb-2.5">{children}</div>
}

function InfoBlock({ label, value, small = false, copyable = false }: { label: string; value: string; small?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    if (!copyable) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  
  return (
    <div 
      className={`bg-bg border border-border rounded-lg px-3.5 py-3 ${copyable ? 'cursor-pointer hover:border-border-strong transition-colors' : ''}`}
      onClick={handleCopy}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-light mb-1">{label}</div>
        {copyable && copied && <span className="text-[10px] text-status-green font-bold">Gekopieerd!</span>}
      </div>
      <div className={`${small ? 'text-[11.5px]' : 'text-[13px]'} font-bold text-navy break-all`}>{value}</div>
    </div>
  )
}

function ContactItem({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      {icon} <strong className="text-navy font-bold">{value}</strong>
    </span>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
        copied 
          ? 'bg-status-green text-white' 
          : 'bg-surface border border-border text-muted hover:border-border-strong hover:text-navy'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Gekopieerd' : 'Kopieer'}
    </button>
  )
}
