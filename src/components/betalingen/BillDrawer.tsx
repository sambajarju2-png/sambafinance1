'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Copy, Check, Save, Mail, Phone, Building2, MessageCircle } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'
import type { DisplayBill } from '@/lib/bill-utils'
import { formatAmount, formatDate, daysUntilDate as daysUntil } from '@/lib/bill-utils'
import type { DbBill } from '@/lib/types'

type DrawerTab = 'details' | 'reactie' | 'notitie'

interface BillDrawerProps {
  bill: DisplayBill | null
  onClose: () => void
  onMarkPaid: (id: string) => void
  onUpdateBill?: (id: string, updates: Partial<DbBill>) => Promise<void>
}

// Extended data for drawer — in production this comes from Supabase
const BILL_EXTRAS: Record<string, {
  contact: { email: string; phone: string; wa?: string }
  breakdown: { date: string; description: string; amount: number }[]
  checklist: { text: string; urgent: boolean }[]
  emailFull: string
  emailPlan: string
  notes: { text: string; date: string }[]
}> = {
  '1': {
    contact: { email: 'evides@flanderijn.nl', phone: '088-209 3140', wa: '06-81020195' },
    breakdown: [
      { date: '18-02-2025', description: 'Periodeafrekening', amount: 26000 },
      { date: '18-02-2025', description: 'Periodeafrekening', amount: 16183 },
      { date: '21-02-2025', description: 'Termijnfactuur', amount: 1800 },
      { date: '17-11-2025', description: 'Periodeafrekening', amount: 25216 },
      { date: '01-11-2023', description: 'Ontvangen betaling', amount: -43200 },
      { date: '—', description: 'Incassokosten', amount: 3250 },
    ],
    checklist: [
      { text: 'Factuurspecificatie controleren', urgent: true },
      { text: 'Keuze: volledig of regeling', urgent: true },
      { text: 'Reageren vóór 15 maart', urgent: true },
      { text: 'Bewaar betaalbevestiging', urgent: false },
    ],
    emailFull: `Aan: evides@flanderijn.nl\nBetreft: Betaling – Dossiernummer 25295267\n\nGeachte medewerker,\n\nHierbij bevestig ik betaling van €366,28 vóór 15 maart 2026 via IBAN NL74 INGB 0693 5601 34, o.v.v. dossiernummer 25295267.\n\nMet vriendelijke groet,\nSamba Jarju`,
    emailPlan: `Aan: evides@flanderijn.nl\nBetreft: Betalingsregeling – 25295267\n\nGeachte medewerker,\n\nIk verzoek een regeling in 3 termijnen:\n• €122,09 – vóór 15 maart\n• €122,09 – vóór 15 april\n• €122,10 – vóór 15 mei\n\nMet vriendelijke groet,\nSamba Jarju`,
    notes: [{ text: 'Gebeld op 10 mrt — gevraagd om betalingsregeling', date: '10 mrt 2026' }],
  },
  '2': {
    contact: { email: 'anderzorg.nl/contact', phone: '—' },
    breakdown: [{ date: '06-03-2026', description: 'Termijn betalingsregeling (incasso mislukt)', amount: 7700 }],
    checklist: [
      { text: 'Betaal €77,00 via iDEAL vóór 17 maart', urgent: true },
      { text: 'Controleer of regeling actief blijft', urgent: true },
    ],
    emailFull: `Aan: Anderzorg Klantenservice\nBetreft: Betaling kenmerk 1000 0102 4008 1676\n\nIk bevestig betaling van €77,00 vóór 17 maart via NL87 INGB 0676 416217.\n\nMet vriendelijke groet,\nSamba Jarju`,
    emailPlan: '',
    notes: [],
  },
  '3': {
    contact: { email: 'WorkWings via Revolut', phone: '—' },
    breakdown: [
      { date: '10-03-2026', description: 'Marketing (maandelijks)', amount: 200000 },
      { date: '10-03-2026', description: '21% BTW', amount: 42000 },
    ],
    checklist: [
      { text: 'Betaal €2.420 via Revolut vóór 17 maart', urgent: true },
      { text: 'Verwerk BTW in boekhouding', urgent: false },
    ],
    emailFull: `Betreft: Bevestiging betaling INV-6-0018\n\nHierbij bevestig ik betaling van factuur INV-6-0018 (€2.420,00 incl. BTW) vóór 17 maart via Revolut Business.\n\nSamba Jarju`,
    emailPlan: `Betreft: Uitstelverzoek INV-6-0018\n\nIk verzoek een korte uitstelperiode tot 24 maart voor factuur INV-6-0018 (€2.420,00).\n\nSamba Jarju`,
    notes: [],
  },
  '4': {
    contact: { email: 'eneco.nl/klantenservice', phone: '—' },
    breakdown: [{ date: '09-03-2026', description: 'Termijnnota energie', amount: 21600 }],
    checklist: [
      { text: 'Betaal €216,00 vóór 24 maart', urgent: true },
      { text: 'Kenmerk: 7000 0114 5324 6412', urgent: true },
    ],
    emailFull: `Aan: Eneco Klantenservice\n\nIk bevestig betaling van nota 1145324641 (€216,00) vóór 24 maart, kenmerk: 7000 0114 5324 6412.\n\nSamba Jarju`,
    emailPlan: `Aan: Eneco Klantenservice\n\nIk verzoek een betalingsregeling voor nota 1145324641:\n• €108,00 – vóór 24 maart\n• €108,00 – vóór 24 april\n\nSamba Jarju`,
    notes: [],
  },
}

export default function BillDrawer({ bill, onClose, onMarkPaid, onUpdateBill }: BillDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('details')
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [emailTab, setEmailTab] = useState<'full' | 'plan'>('full')
  const [copied, setCopied] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savedNotes, setSavedNotes] = useState<{ text: string; date: string }[]>([])

  const isOpen = bill !== null

  // Reset state when bill changes
  useEffect(() => {
    if (bill) {
      setActiveTab('details')
      setCheckedItems({})
      setEmailTab('full')
      setCopied(false)
      setNoteText('')

      // Parse notes from DB field or fall back to extras
      const extras = BILL_EXTRAS[bill.id]
      if (bill.notes) {
        const parsed = bill.notes.split('\n').filter(Boolean).map((line) => {
          const match = line.match(/^\[(.+?)\]\s*(.+)$/)
          return match
            ? { date: match[1], text: match[2] }
            : { date: '—', text: line }
        })
        setSavedNotes(parsed)
      } else {
        setSavedNotes(extras?.notes ? [...extras.notes] : [])
      }
    }
  }, [bill?.id, bill?.notes])

  // ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!bill) return null

  const extras = BILL_EXTRAS[bill.id]
  const days = daysUntil(bill.dueDate)
  const isPaid = bill.status === 'settled'
  const urgColor = days !== null && days <= 4 ? 'text-status-red' : days !== null && days <= 10 ? 'text-status-amber' : 'text-brand-blue'

  function handleCopy() {
    const text = emailTab === 'full' ? extras?.emailFull : extras?.emailPlan
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
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

    // Persist to Supabase via API
    if (onUpdateBill) {
      const notesStr = updatedNotes.map((n) => `[${n.date}] ${n.text}`).join('\n')
      await onUpdateBill(bill.id, { notes: notesStr })
    }
  }

  // Progress bar for deadline
  let progressPct = 0
  if (bill.dueDate) {
    const issued = new Date('2026-03-01').getTime()
    const due = new Date(bill.dueDate).getTime()
    const now = new Date().getTime()
    progressPct = Math.min(100, Math.max(0, ((now - issued) / (due - issued)) * 100))
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`
          fixed inset-0 bg-navy/20 backdrop-blur-[3px] z-[100]
          transition-opacity duration-250
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 bottom-0 w-full sm:w-[min(600px,100vw)]
          bg-surface border-l border-border z-[200]
          transition-transform duration-300 ease-out
          overflow-y-auto shadow-drawer flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="px-5 md:px-6 pt-5 pb-4 border-b border-border sticky top-0 bg-surface z-10 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-[42px] h-[42px] rounded-[10px] flex items-center justify-center text-[16px] font-extrabold border border-black/[.06] flex-shrink-0"
              style={{ background: bill.avatarBg, color: bill.avatarFg }}
            >
              {bill.initials}
            </div>
            <div>
              <div className="text-[15.5px] font-extrabold text-navy">{bill.vendor}</div>
              <div className="text-[12px] text-muted">{bill.category} · {bill.reference}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-[7px] border border-border bg-surface text-muted flex items-center justify-center hover:bg-bg hover:text-navy transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 md:px-6 sticky top-[79px] bg-surface z-[9]">
          {(['details', 'reactie', 'notitie'] as DrawerTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-3 text-[12.5px] font-semibold border-b-2 -mb-[1px] transition-colors whitespace-nowrap capitalize
                ${activeTab === tab
                  ? 'text-brand-blue border-brand-blue'
                  : 'text-muted border-transparent hover:text-navy'
                }
              `}
            >
              {tab === 'details' ? 'Details' : tab === 'reactie' ? 'Reactie' : 'Notitie'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 px-5 md:px-6 py-5">

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && (
            <div>
              {/* Amount */}
              <div className="text-[36px] font-extrabold text-navy tracking-tight leading-none mb-1.5">
                {formatAmount(bill.amount)}
              </div>
              <div className="mb-4">
                <StatusBadge urgency={isPaid ? 'paid' : bill.urgency} />
              </div>

              {/* Progress bar */}
              {bill.dueDate && !isPaid && (
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-muted mb-1.5">
                    <span>1 maart</span>
                    <span className={`font-bold ${urgColor}`}>
                      {days !== null && days <= 0 ? 'Verlopen!' : `${days} dagen resterend`}
                    </span>
                    <span>{formatDate(bill.dueDate)}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${progressPct}%`,
                        background: days !== null && days <= 4
                          ? '#DC2626'
                          : days !== null && days <= 10
                            ? '#D97706'
                            : '#3B82F6',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2.5 mt-4">
                <InfoBlock label="Deadline" value={isPaid ? formatDate(bill.paidAt) : formatDate(bill.dueDate)} valueClass={urgColor} />
                <InfoBlock label="Categorie" value={bill.category} />
                <InfoBlock label="Kenmerk" value={bill.reference} small />
                <InfoBlock label="Account" value={bill.assignedTo === 'joint' ? 'Gezamenlijk' : bill.assignedTo === 'mine' ? 'Samba' : 'Vrouw'} />
              </div>

              {/* Breakdown table */}
              {extras?.breakdown && extras.breakdown.length > 0 && (
                <div className="mt-5">
                  <SectionTitle>Factuurspecificatie</SectionTitle>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="bg-bg px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Datum</th>
                          <th className="bg-bg px-3 py-2 text-left text-[10.5px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Omschrijving</th>
                          <th className="bg-bg px-3 py-2 text-right text-[10.5px] font-bold uppercase tracking-[.07em] text-muted border-b border-border">Bedrag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {extras.breakdown.map((row, i) => (
                          <tr key={i} className="border-b border-border last:border-b-0">
                            <td className="px-3 py-2.5 text-[12px] text-muted">{row.date}</td>
                            <td className="px-3 py-2.5 text-[12.5px] text-navy">{row.description}</td>
                            <td className={`px-3 py-2.5 text-[12.5px] text-right font-bold ${row.amount < 0 ? 'text-status-green' : 'text-navy'}`}>
                              {row.amount < 0 ? '−' : ''}€{'\u00A0'}{(Math.abs(row.amount) / 100).toFixed(2).replace('.', ',')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Checklist */}
              {extras?.checklist && extras.checklist.length > 0 && (
                <div className="mt-5">
                  <SectionTitle>Actielijst</SectionTitle>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {extras.checklist.map((item, i) => {
                      const done = !!checkedItems[i]
                      return (
                        <button
                          key={i}
                          onClick={() => setCheckedItems({ ...checkedItems, [i]: !done })}
                          className={`
                            w-full flex items-start gap-3 px-3.5 py-3 border-b border-border last:border-b-0
                            text-left transition-colors hover:bg-[#FAFCFF]
                            ${done ? 'opacity-50' : ''}
                          `}
                        >
                          <span
                            className={`
                              w-[17px] h-[17px] rounded flex items-center justify-center flex-shrink-0 mt-[1px] transition-all
                              ${done
                                ? 'bg-brand-blue border-brand-blue'
                                : 'border-[1.5px] border-border-strong'
                              }
                            `}
                          >
                            {done && (
                              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-[13px] leading-relaxed ${done ? 'line-through text-muted' : 'text-navy'}`}>
                            {item.text}
                            {item.urgent && !done && (
                              <span className="inline-block ml-1.5 text-[9.5px] font-bold uppercase px-1.5 py-[1px] rounded bg-status-red-pale text-status-red">
                                Urgent
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Contact */}
              {extras?.contact && (
                <div className="mt-5">
                  <SectionTitle>Contact</SectionTitle>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {extras.contact.email && (
                      <ContactItem icon={<Mail className="w-3.5 h-3.5" />} value={extras.contact.email} />
                    )}
                    {extras.contact.phone && extras.contact.phone !== '—' && (
                      <ContactItem icon={<Phone className="w-3.5 h-3.5" />} value={extras.contact.phone} />
                    )}
                    {bill.iban && (
                      <ContactItem icon={<Building2 className="w-3.5 h-3.5" />} value={bill.iban} />
                    )}
                    {extras.contact.wa && (
                      <ContactItem icon={<MessageCircle className="w-3.5 h-3.5" />} value={extras.contact.wa} />
                    )}
                  </div>
                </div>
              )}

              {/* Mark as paid button */}
              {!isPaid && (
                <button
                  onClick={() => onMarkPaid(bill.id)}
                  className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Markeer als betaald
                </button>
              )}
            </div>
          )}

          {/* ── REACTIE TAB ── */}
          {activeTab === 'reactie' && (
            <div>
              {(!extras?.emailFull && !extras?.emailPlan) ? (
                <p className="text-muted text-[13px]">Geen e-maildraft beschikbaar voor deze betaling.</p>
              ) : (
                <>
                  {extras.emailFull && extras.emailPlan && (
                    <div className="flex gap-[1px] bg-border rounded-lg overflow-hidden mb-3">
                      <button
                        onClick={() => setEmailTab('full')}
                        className={`flex-1 py-2.5 text-[12.5px] font-bold text-center transition-colors ${emailTab === 'full' ? 'bg-surface text-navy shadow-card' : 'bg-bg text-muted'}`}
                      >
                        Volledig betalen
                      </button>
                      <button
                        onClick={() => setEmailTab('plan')}
                        className={`flex-1 py-2.5 text-[12.5px] font-bold text-center transition-colors ${emailTab === 'plan' ? 'bg-surface text-navy shadow-card' : 'bg-bg text-muted'}`}
                      >
                        Betalingsregeling
                      </button>
                    </div>
                  )}
                  <div className="bg-bg border border-border rounded-lg p-3.5 text-[12.5px] leading-relaxed text-slate-600 whitespace-pre-wrap max-h-[220px] overflow-y-auto font-sans">
                    {emailTab === 'full' ? extras?.emailFull : extras?.emailPlan}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`
                      inline-flex items-center gap-1.5 mt-2.5 px-4 py-2 rounded-[7px] text-[12.5px] font-bold transition-colors
                      ${copied
                        ? 'bg-status-green text-white'
                        : 'bg-navy text-white hover:bg-navy-light'
                      }
                    `}
                  >
                    {copied ? <><Check className="w-3.5 h-3.5" /> Gekopieerd!</> : <><Copy className="w-3.5 h-3.5" /> Kopieer e-mail</>}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── NOTITIE TAB ── */}
          {activeTab === 'notitie' && (
            <div>
              <SectionTitle>Notitie toevoegen</SectionTitle>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Typ hier je notitie… bijv. 'Gebeld op 12 mrt, afgesproken om 15 mrt te betalen'"
                className="w-full min-h-[120px] border border-border rounded-lg p-3.5 text-[13px] text-txt resize-y outline-none transition-colors bg-bg focus:border-brand-blue-hover focus:bg-surface font-sans"
              />
              <button
                onClick={handleSaveNote}
                className="inline-flex items-center gap-1.5 mt-2.5 px-4 py-2 rounded-[7px] bg-brand-blue text-white text-[12.5px] font-bold hover:bg-brand-blue-hover transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Notitie opslaan
              </button>

              {/* Saved notes */}
              {savedNotes.length > 0 && (
                <div className="mt-5">
                  <div className="text-[11px] font-bold uppercase tracking-[.08em] text-muted-light mb-2.5">
                    Eerdere notities
                  </div>
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

              {savedNotes.length === 0 && (
                <p className="text-[12px] text-muted-light mt-4">Nog geen notities.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[.1em] text-muted-light mb-2.5">
      {children}
    </div>
  )
}

function InfoBlock({ label, value, valueClass = '', small = false }: {
  label: string
  value: string
  valueClass?: string
  small?: boolean
}) {
  return (
    <div className="bg-bg border border-border rounded-lg px-3.5 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-[.07em] text-muted-light mb-1">{label}</div>
      <div className={`${small ? 'text-[11.5px]' : 'text-[13px]'} font-bold text-navy ${valueClass}`}>{value}</div>
    </div>
  )
}

function ContactItem({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      {icon}
      <strong className="text-navy font-bold">{value}</strong>
    </span>
  )
}
