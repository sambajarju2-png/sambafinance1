'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, Wallet, Bell, RefreshCw, Plus, LogOut, User, ExternalLink, Loader2, CheckCircle2, Key, Scan, Inbox } from 'lucide-react'
import { CATEGORY_DATA } from '@/lib/mock-data'
import { formatAmount } from '@/lib/bill-utils'

type SettingsTab = 'accounts' | 'budget' | 'notif' | 'sync' | 'profile'

interface GmailAccount { email: string; connected: boolean; expired: boolean; lastScanned: string | null; fullScanComplete: boolean }
interface InstellingenViewProps { onSignOut?: () => void; userName?: string; userEmail?: string; accessToken?: string; onRefetch?: () => void; initialTab?: string }

const NAV_ITEMS: { id: SettingsTab; label: string; icon: typeof Mail }[] = [
  { id: 'profile', label: 'Profiel', icon: User },
  { id: 'accounts', label: 'Email accounts', icon: Mail },
  { id: 'budget', label: 'Budget', icon: Wallet },
  { id: 'notif', label: 'Notificaties', icon: Bell },
  { id: 'sync', label: 'Sync & AI', icon: RefreshCw },
]

export default function InstellingenView({ onSignOut, userName, userEmail, accessToken, onRefetch, initialTab }: InstellingenViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [budgets, setBudgets] = useState<Record<string, number>>(Object.fromEntries(CATEGORY_DATA.map(c => [c.name, c.budget])))
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [gmailLoading, setGmailLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ scanned: number; created: number; duplicates: number; batches: number } | null>(null)
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [budgetSaved, setBudgetSaved] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const abortRef = useRef(false)

  const headers = useCallback(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }, [accessToken])

  useEffect(() => {
    if (initialTab && ['accounts', 'budget', 'notif', 'sync', 'profile'].includes(initialTab)) {
      setActiveTab(initialTab as SettingsTab)
    }
  }, [initialTab])

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/gmail/status', { headers: headers() }).then(r => r.json()).then(d => { if (d.accounts) setGmailAccounts(d.accounts) }).catch(() => {}).finally(() => setGmailLoading(false))
  }, [accessToken, headers])

  useEffect(() => {
    if (!accessToken) return
    fetch('/api/settings', { headers: headers() }).then(r => r.json()).then(d => {
      if (d.data?.anthropic_api_key) { setApiKey(d.data.anthropic_api_key); setApiKeySaved(true) }
      if (d.data?.first_name) setFirstName(d.data.first_name)
      if (d.data?.last_name) setLastName(d.data.last_name)
      if (d.data?.budgets && Object.keys(d.data.budgets).length > 0) setBudgets(d.data.budgets)
    }).catch(() => {})
  }, [accessToken, headers])

  // Progressive batch scanner
  async function handleScan(mode: 'initial' | 'daily') {
    setScanning(true); setScanDone(false); setScanError(null); abortRef.current = false
    setScanProgress({ scanned: 0, created: 0, duplicates: 0, batches: 0 })

    let pageToken: string | undefined = undefined
    let totalScanned = 0, totalCreated = 0, totalDuplicates = 0, batchCount = 0
    const maxEmails = mode === 'initial' ? 100 : 100

    try {
      while (!abortRef.current && totalScanned < maxEmails) {
        const res: Response = await fetch('/api/gmail/scan', {
          method: 'POST', headers: headers(),
          body: JSON.stringify({ mode, pageToken }),
        })
        const data: { scanned?: number; created?: number; duplicates?: number; done?: boolean; nextPageToken?: string; error?: string } = await res.json()

        if (!res.ok) { setScanError(data.error || 'Scan mislukt'); break }

        totalScanned += data.scanned || 0
        totalCreated += data.created || 0
        totalDuplicates += data.duplicates || 0
        batchCount++
        setScanProgress({ scanned: totalScanned, created: totalCreated, duplicates: totalDuplicates, batches: batchCount })

        if (data.done || !data.nextPageToken) { setScanDone(true); break }
        pageToken = data.nextPageToken
      }
      if (onRefetch) onRefetch()
    } catch { setScanError('Scan mislukt — controleer je verbinding') }
    finally { setScanning(false) }
  }

  async function handleSaveApiKey() {
    setApiKeySaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: headers(), body: JSON.stringify({ anthropic_api_key: apiKey.trim() }) })
      if (res.ok) { setApiKeySaved(true); setTimeout(() => setApiKeySaved(false), 3000) }
    } catch {} finally { setApiKeySaving(false) }
  }

  async function handleSaveBudgets() {
    setBudgetSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: headers(), body: JSON.stringify({ budgets }) })
      if (res.ok) { setBudgetSaved(true); setTimeout(() => setBudgetSaved(false), 3000) }
    } catch {} finally { setBudgetSaving(false) }
  }

  async function handleSaveName() {
    setNameSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: headers(), body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }) })
      if (res.ok) { setNameSaved(true); setTimeout(() => setNameSaved(false), 3000) }
    } catch {} finally { setNameSaving(false) }
  }

  const hasGmail = gmailAccounts.length > 0
  const fullScanDone = gmailAccounts.some(a => a.fullScanComplete)

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
      <div className="flex md:flex-col gap-[2px] overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
        {NAV_ITEMS.map(item => { const Icon = item.icon; const a = activeTab === item.id; return (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap flex-shrink-0 ${a ? 'bg-brand-blue-pale text-brand-blue font-bold' : 'text-muted hover:bg-surface-2 hover:text-navy'}`}>
            <Icon className="w-[15px] h-[15px]" />{item.label}
          </button>
        )})}
      </div>

      <div>
        {activeTab === 'profile' && (
          <Card title="Mijn profiel">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-blue-hover to-blue-700 flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0">{(firstName || userName || 'U').slice(0, 2).toUpperCase()}</div>
              <div><div className="text-[15px] font-bold text-navy">{firstName && lastName ? `${firstName} ${lastName}` : userName || 'Gebruiker'}</div><div className="text-[13px] text-muted">{userEmail || '—'}</div></div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">Voornaam</label>
                  <input type="text" value={firstName} onChange={e => { setFirstName(e.target.value); setNameSaved(false) }} placeholder="Bijv. Samba" className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans placeholder:text-muted-light" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">Achternaam</label>
                  <input type="text" value={lastName} onChange={e => { setLastName(e.target.value); setNameSaved(false) }} placeholder="Bijv. Jarju" className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans placeholder:text-muted-light" />
                </div>
              </div>
              <button onClick={handleSaveName} disabled={nameSaving || (!firstName.trim() && !lastName.trim())} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-colors ${nameSaved ? 'bg-status-green text-white' : 'bg-navy text-white hover:bg-navy-light disabled:opacity-50'}`}>
                {nameSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : nameSaved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Opgeslagen</> : 'Naam opslaan'}
              </button>
            </div>
            <p className="text-[12px] text-muted mt-4 pt-3 border-t border-border">Je partner heeft een apart account. Zij kan zelf registreren en haar eigen Gmail-inboxen koppelen.</p>
            {onSignOut && <button onClick={onSignOut} className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-lg border border-status-red-mid bg-status-red-pale text-status-red text-[13px] font-bold hover:bg-status-red-mid transition-colors"><LogOut className="w-4 h-4" /> Uitloggen</button>}
          </Card>
        )}

        {activeTab === 'accounts' && (
          <>
            <Card title="Gekoppelde Gmail accounts" sub="Je kunt meerdere Gmail-inboxen koppelen">
              {gmailLoading ? (
                <div className="flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin text-muted" /><span className="text-[13px] text-muted">Status laden...</span></div>
              ) : (
                <>
                  {gmailAccounts.map(acc => (
                    <div key={acc.email} className="flex items-center gap-3 py-3 border-b border-border last:border-b-0">
                      <div className="w-9 h-9 rounded-[9px] bg-surface-2 border border-border flex items-center justify-center text-[16px] flex-shrink-0">📧</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-navy">{acc.email}</div>
                        <div className="text-[12px] text-muted">{acc.lastScanned ? `Laatste scan: ${new Date(acc.lastScanned).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Nog niet gescand'}</div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full border bg-status-green-pale text-status-green border-status-green-mid">✓ Verbonden</span>
                    </div>
                  ))}
                  <button onClick={() => { window.location.href = `/api/gmail/connect?token=${encodeURIComponent(accessToken || '')}` }} className="flex items-center gap-2 mt-3 text-[13px] font-bold text-brand-blue hover:text-brand-blue-hover transition-colors">
                    <Plus className="w-4 h-4" /> Extra Gmail-inbox koppelen
                  </button>
                </>
              )}
              {!gmailLoading && !hasGmail && (
                <button onClick={() => { window.location.href = `/api/gmail/connect?token=${encodeURIComponent(accessToken || '')}` }} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light transition-colors mt-2">
                  <Plus className="w-4 h-4" /> Gmail account koppelen
                </button>
              )}
            </Card>

            {hasGmail && (
              <Card title="Inbox scannen" sub="Scan je e-mails voor facturen met PDF-bijlagen">
                <div className="flex flex-wrap gap-2">
                  {!fullScanDone && (
                    <button onClick={() => handleScan('initial')} disabled={scanning} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy text-white text-[13px] font-bold hover:bg-navy-light disabled:opacity-60 transition-colors">
                      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
                      {scanning ? 'Bezig...' : 'Scan inbox (laatste 14 dagen)'}
                    </button>
                  )}
                  <button onClick={() => handleScan('daily')} disabled={scanning} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-bold hover:bg-brand-blue-hover disabled:opacity-60 transition-colors">
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                    {scanning ? 'Scannen...' : 'Scan recente e-mails'}
                  </button>
                  {scanning && <button onClick={() => { abortRef.current = true }} className="px-3 py-2.5 rounded-lg border border-border text-[12.5px] font-semibold text-muted hover:text-navy transition-colors">Stop</button>}
                </div>
                {scanProgress && (
                  <div className="mt-3 px-3.5 py-3 bg-bg border border-border rounded-lg">
                    <div className="flex items-center gap-4 text-[12.5px]">
                      <span className="text-muted"><strong className="text-navy">{scanProgress.scanned}</strong> e-mails gescand</span>
                      <span className="text-status-green font-bold">{scanProgress.created} nieuw</span>
                      {scanProgress.duplicates > 0 && <span className="text-muted">{scanProgress.duplicates} duplicaten</span>}
                      <span className="text-muted-light">batch {scanProgress.batches}</span>
                    </div>
                    {scanning && <div className="mt-2 h-1 bg-border rounded-full overflow-hidden"><div className="h-full bg-brand-blue rounded-full animate-pulse" style={{ width: '60%' }} /></div>}
                    {scanDone && <div className="mt-2 text-[12px] font-semibold text-status-green">✓ Scan compleet</div>}
                  </div>
                )}
                {scanError && <div className="mt-3 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium border bg-status-red-pale border-status-red-mid text-status-red">✗ {scanError}</div>}
              </Card>
            )}

            <Card title="Sync instellingen">
              <Toggle label="PDF-bijlagen scannen" sub="Facturen als PDF-bijlage extracten via AI" defaultOn />
              <Toggle label="Deduplicatie" sub="Herken duplicaten (herinnering = zelfde factuur)" defaultOn />
            </Card>
          </>
        )}

        {activeTab === 'budget' && (
          <Card title="Maandbudget per categorie" sub="Stel je maximale maandbudget in per categorie">
            <div className="space-y-3">
              {CATEGORY_DATA.map(cat => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-[140px] flex-shrink-0"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} /><span className="text-[13px] font-semibold text-navy">{cat.name}</span></div>
                  <div className="relative flex-1 max-w-[140px]"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">€</span><input type="number" value={budgets[cat.name] / 100} onChange={e => setBudgets({ ...budgets, [cat.name]: Math.round(parseFloat(e.target.value || '0') * 100) })} className="w-full pl-7 pr-3 py-2 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans" /></div>
                  <span className="text-[12px] text-muted">/maand</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
              <span className="text-[12.5px] text-muted">Totaal: <strong className="text-navy">{formatAmount(Object.values(budgets).reduce((s, v) => s + v, 0))}</strong></span>
              <button onClick={handleSaveBudgets} disabled={budgetSaving} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-bold transition-colors ${budgetSaved ? 'bg-status-green text-white' : 'bg-brand-blue text-white hover:bg-brand-blue-hover disabled:opacity-50'}`}>
                {budgetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : budgetSaved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Opgeslagen</> : 'Opslaan'}
              </button>
            </div>
          </Card>
        )}

        {activeTab === 'notif' && (
          <Card title="Meldingsinstellingen">
            <Toggle label="Melding bij nieuwe betaling" sub="Direct als een nieuwe factuur gedetecteerd wordt" defaultOn />
            <Toggle label="Deadline herinnering (7 dagen)" sub="7 dagen vóór deadline een melding sturen" defaultOn />
            <Toggle label="Deadline herinnering (3 dagen)" sub="3 dagen vóór deadline een melding sturen" defaultOn />
            <Toggle label="Deadline herinnering (1 dag)" sub="1 dag vóór deadline — kritieke alert" defaultOn />
            <Toggle label="Mislukte betaling alert" sub="Direct bij een stornering of mislukte incasso" defaultOn />
            <Toggle label="Wekelijkse digest" sub="Elke maandag 08:00 een samenvatting" defaultOn={false} />
          </Card>
        )}

        {activeTab === 'sync' && (
          <>
            <Card title="Anthropic API Key" sub="Vereist voor AI-extractie van facturen uit PDF's">
              <div className="flex items-center gap-2">
                <div className="relative flex-1"><Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" /><input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); setApiKeySaved(false) }} placeholder="sk-ant-api03-..." className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans font-mono placeholder:font-sans placeholder:text-muted-light" /></div>
                <button onClick={handleSaveApiKey} disabled={apiKeySaving || !apiKey.trim()} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[12.5px] font-bold transition-colors whitespace-nowrap ${apiKeySaved ? 'bg-status-green text-white' : 'bg-navy text-white hover:bg-navy-light disabled:opacity-50'}`}>
                  {apiKeySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : apiKeySaved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Opgeslagen</> : 'Opslaan'}
                </button>
              </div>
              <p className="text-[11.5px] text-muted-light mt-2">Maak een key aan op <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand-blue font-semibold hover:text-brand-blue-hover inline-flex items-center gap-0.5">console.anthropic.com <ExternalLink className="w-3 h-3" /></a>. Je key wordt veilig opgeslagen en alleen gebruikt voor het scannen van jouw facturen.</p>
            </Card>
            <Card title="AI Extractie instellingen">
              <Toggle label="Claude Haiku (goedkoopst)" sub="~€0,20/maand · aanbevolen voor extraction" defaultOn />
              <Toggle label="Automatische deduplicatie via AI" sub="Herken of herinnering over dezelfde factuur gaat" defaultOn />
              <Toggle label="Pre-filter (voor AI)" sub="Eerst regex check, dan pas API aanroepen (bespaart kosten)" defaultOn />
              <div className="mt-4 p-3.5 bg-brand-blue-pale border border-brand-blue-mid rounded-lg"><div className="text-[12.5px] font-bold text-brand-blue mb-1">💡 Kosten schatting</div><div className="text-[12px] text-blue-700">~20 nieuwe mails/dag × 30 dagen × Haiku = <strong>€0,18/maand</strong></div></div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden mb-4"><div className="px-5 py-[18px] border-b border-border"><div className="text-[13.5px] font-bold text-navy">{title}</div>{sub && <div className="text-[12px] text-muted mt-[2px]">{sub}</div>}</div><div className="px-5 py-5">{children}</div></div>
}
function Toggle({ label, sub, defaultOn = false }: { label: string; sub: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0"><div><div className="text-[13px] font-semibold text-navy">{label}</div><div className="text-[12px] text-muted mt-[1px]">{sub}</div></div><button onClick={() => setOn(!on)} className={`relative w-9 h-5 rounded-full flex-shrink-0 transition-colors ml-4 ${on ? 'bg-brand-blue' : 'bg-border-strong'}`}><span className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${on ? 'left-[18px]' : 'left-[2px]'}`} /></button></div>
}
