'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Mail, Key, Scan, CheckCircle2, Loader2, ExternalLink, ArrowRight, Inbox, CreditCard, AlertCircle } from 'lucide-react'

interface OnboardingViewProps {
  accessToken: string | null
  onComplete: () => void
  userEmail?: string
}

interface GmailAccount {
  email: string
  connected: boolean
  expired: boolean
  lastScanned: string | null
  fullScanComplete: boolean
}

type Step = 'gmail' | 'apikey' | 'scan'

export default function OnboardingView({ accessToken, onComplete, userEmail }: OnboardingViewProps) {
  const [currentStep, setCurrentStep] = useState<Step>('gmail')
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [gmailLoading, setGmailLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ scanned: number; created: number; duplicates: number; batches: number } | null>(null)
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }, [accessToken])

  // Check Gmail status and API key on mount
  useEffect(() => {
    if (!accessToken) { setGmailLoading(false); return }

    // Check Gmail
    fetch('/api/gmail/status', { headers: headers() })
      .then(r => r.json())
      .then(d => {
        if (d.accounts && d.accounts.length > 0) {
          setGmailAccounts(d.accounts)
          // Auto-advance to API key step
          setCurrentStep('apikey')
        }
      })
      .catch(() => {})
      .finally(() => setGmailLoading(false))

    // Check API key
    fetch('/api/settings', { headers: headers() })
      .then(r => r.json())
      .then(d => {
        if (d.data?.anthropic_api_key) {
          setApiKey(d.data.anthropic_api_key)
          setApiKeySaved(true)
        }
      })
      .catch(() => {})
  }, [accessToken, headers])

  // Auto-advance: if Gmail connected AND API key saved, go to scan step
  useEffect(() => {
    if (gmailAccounts.length > 0 && apiKeySaved) {
      setCurrentStep('scan')
    } else if (gmailAccounts.length > 0) {
      setCurrentStep('apikey')
    }
  }, [gmailAccounts, apiKeySaved])

  // Detect ?gmail=connected in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      // Refresh Gmail status
      if (accessToken) {
        fetch('/api/gmail/status', { headers: headers() })
          .then(r => r.json())
          .then(d => {
            if (d.accounts && d.accounts.length > 0) {
              setGmailAccounts(d.accounts)
              setCurrentStep('apikey')
            }
          })
          .catch(() => {})
      }
    }
  }, [accessToken, headers])

  function handleConnectGmail() {
    window.location.href = `/api/gmail/connect?token=${encodeURIComponent(accessToken || '')}`
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return
    setApiKeySaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ anthropic_api_key: apiKey.trim() }),
      })
      if (res.ok) {
        setApiKeySaved(true)
        setCurrentStep('scan')
      }
    } catch {}
    finally { setApiKeySaving(false) }
  }

  async function handleStartScan() {
    setScanning(true)
    setScanDone(false)
    setScanError(null)
    abortRef.current = false
    setScanProgress({ scanned: 0, created: 0, duplicates: 0, batches: 0 })

    let pageToken: string | undefined = undefined
    let totalScanned = 0
    let totalCreated = 0
    let totalDuplicates = 0
    let batchCount = 0
    const maxEmails = 300

    try {
      while (!abortRef.current && totalScanned < maxEmails) {
        const res: Response = await fetch('/api/gmail/scan', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ mode: 'initial', pageToken }),
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
      if (!abortRef.current) setScanDone(true)
    } catch {
      setScanError('Scan mislukt — controleer je verbinding')
    } finally {
      setScanning(false)
    }
  }

  const steps: { id: Step; label: string; icon: typeof Mail }[] = [
    { id: 'gmail', label: 'Gmail koppelen', icon: Mail },
    { id: 'apikey', label: 'AI instellen', icon: Key },
    { id: 'scan', label: 'Inbox scannen', icon: Scan },
  ]
  const stepIndex = steps.findIndex(s => s.id === currentStep)

  if (gmailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-blue animate-spin mb-3" />
        <span className="text-[13px] text-muted">Status controleren...</span>
      </div>
    )
  }

  return (
    <div className="max-w-[560px] mx-auto py-6 md:py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-blue-hover to-blue-700 rounded-[10px] flex items-center justify-center shadow-[0_2px_10px_rgba(37,99,235,.4)]">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold text-navy tracking-tight">Welkom bij PayWatch</h1>
        <p className="text-[14px] text-muted mt-1.5">Stel je account in om je facturen automatisch te beheren</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((step, i) => {
          const Icon = step.icon
          const isActive = i === stepIndex
          const isDone = i < stepIndex || (step.id === 'gmail' && gmailAccounts.length > 0) || (step.id === 'apikey' && apiKeySaved)
          return (
            <div key={step.id} className="flex items-center">
              {i > 0 && <div className={`w-12 h-[2px] mx-1 rounded-full transition-colors ${isDone ? 'bg-brand-blue' : 'bg-border'}`} />}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDone ? 'bg-brand-blue text-white' : isActive ? 'bg-brand-blue-pale text-brand-blue border-2 border-brand-blue' : 'bg-bg text-muted border border-border'}`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10.5px] font-semibold whitespace-nowrap ${isActive ? 'text-brand-blue' : isDone ? 'text-navy' : 'text-muted-light'}`}>{step.label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
        {/* Step 1: Gmail */}
        {currentStep === 'gmail' && (
          <div className="px-6 py-8">
            <div className="w-14 h-14 rounded-xl bg-status-red-pale flex items-center justify-center mx-auto mb-5">
              <Mail className="w-7 h-7 text-status-red" />
            </div>
            <h2 className="text-[17px] font-extrabold text-navy text-center mb-2">Koppel je Gmail account</h2>
            <p className="text-[13.5px] text-muted text-center max-w-[400px] mx-auto mb-6 leading-relaxed">
              PayWatch scant je inbox op facturen als PDF-bijlage. We lezen alleen e-mails — we versturen of wijzigen niets.
            </p>

            {gmailAccounts.length > 0 ? (
              <div className="mb-5">
                {gmailAccounts.map(acc => (
                  <div key={acc.email} className="flex items-center gap-3 px-4 py-3 bg-status-green-pale border border-status-green-mid rounded-lg mb-2">
                    <CheckCircle2 className="w-5 h-5 text-status-green flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-navy">{acc.email}</div>
                      <div className="text-[11.5px] text-status-green">Verbonden</div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setCurrentStep('apikey')} className="w-full flex items-center justify-center gap-2 mt-3 px-5 py-3 rounded-lg bg-navy text-white text-[13.5px] font-bold hover:bg-navy-light transition-colors">
                  Volgende stap <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={handleConnectGmail} className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg bg-navy text-white text-[14px] font-bold hover:bg-navy-light transition-colors">
                <Mail className="w-4.5 h-4.5" /> Koppel Gmail account
              </button>
            )}

            <p className="text-[11.5px] text-muted-light text-center mt-4">
              We gebruiken alleen-lezen toegang (gmail.readonly). Je kunt dit altijd intrekken via je Google-account.
            </p>
          </div>
        )}

        {/* Step 2: API Key */}
        {currentStep === 'apikey' && (
          <div className="px-6 py-8">
            <div className="w-14 h-14 rounded-xl bg-brand-blue-pale flex items-center justify-center mx-auto mb-5">
              <Key className="w-7 h-7 text-brand-blue" />
            </div>
            <h2 className="text-[17px] font-extrabold text-navy text-center mb-2">Anthropic API Key</h2>
            <p className="text-[13.5px] text-muted text-center max-w-[400px] mx-auto mb-6 leading-relaxed">
              PayWatch gebruikt Claude Haiku AI om factuurgegevens uit PDF-bijlagen te extraheren. Geschatte kosten: ~€0,20/maand.
            </p>

            {/* Connected Gmail summary */}
            {gmailAccounts.length > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-status-green-pale border border-status-green-mid rounded-lg mb-4 text-[12.5px]">
                <CheckCircle2 className="w-4 h-4 text-status-green flex-shrink-0" />
                <span className="text-navy font-semibold">{gmailAccounts[0].email}</span>
                <span className="text-status-green">gekoppeld</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-navy uppercase tracking-[.05em] mb-1.5">API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setApiKeySaved(false) }}
                    placeholder="sk-ant-api03-..."
                    className="w-full pl-9 pr-3 py-3 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-sans font-mono placeholder:font-sans placeholder:text-muted-light"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveApiKey}
                disabled={apiKeySaving || !apiKey.trim()}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[13.5px] font-bold transition-colors ${apiKeySaved ? 'bg-status-green text-white' : 'bg-navy text-white hover:bg-navy-light disabled:opacity-50'}`}
              >
                {apiKeySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : apiKeySaved ? <><CheckCircle2 className="w-4 h-4" /> Opgeslagen — door naar scan</> : <>Opslaan en doorgaan <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <p className="text-[11.5px] text-muted-light text-center mt-4">
              Maak een key aan op{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand-blue font-semibold hover:text-brand-blue-hover inline-flex items-center gap-0.5">
                console.anthropic.com <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        )}

        {/* Step 3: Scan */}
        {currentStep === 'scan' && (
          <div className="px-6 py-8">
            <div className="w-14 h-14 rounded-xl bg-status-green-pale flex items-center justify-center mx-auto mb-5">
              <Inbox className="w-7 h-7 text-status-green" />
            </div>
            <h2 className="text-[17px] font-extrabold text-navy text-center mb-2">Scan je inbox</h2>
            <p className="text-[13.5px] text-muted text-center max-w-[400px] mx-auto mb-6 leading-relaxed">
              We scannen je laatste 300 e-mails met PDF-bijlagen. Factuurgegevens worden automatisch geëxtraheerd door AI. Na deze eerste scan controleren we dagelijks de laatste 100 e-mails.
            </p>

            {/* Connected services summary */}
            <div className="flex flex-col gap-2 mb-5">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-status-green-pale border border-status-green-mid rounded-lg text-[12.5px]">
                <CheckCircle2 className="w-4 h-4 text-status-green flex-shrink-0" />
                <span className="text-navy font-semibold">{gmailAccounts[0]?.email || 'Gmail'}</span>
                <span className="text-status-green">gekoppeld</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-status-green-pale border border-status-green-mid rounded-lg text-[12.5px]">
                <CheckCircle2 className="w-4 h-4 text-status-green flex-shrink-0" />
                <span className="text-navy font-semibold">Claude Haiku AI</span>
                <span className="text-status-green">geconfigureerd</span>
              </div>
            </div>

            {/* Scan button or progress */}
            {!scanning && !scanDone && (
              <button
                onClick={handleStartScan}
                className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg bg-navy text-white text-[14px] font-bold hover:bg-navy-light transition-colors"
              >
                <Scan className="w-5 h-5" /> Start eerste scan (300 e-mails)
              </button>
            )}

            {/* Scan progress */}
            {(scanning || scanProgress) && (
              <div className="mt-4">
                {scanning && (
                  <div className="mb-3">
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-blue rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(((scanProgress?.scanned || 0) / 300) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[12px] text-muted flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scannen...
                      </span>
                      <span className="text-[12px] text-muted">{scanProgress?.scanned || 0} / 300 e-mails</span>
                    </div>
                  </div>
                )}

                {scanProgress && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-bg border border-border rounded-lg px-3.5 py-3 text-center">
                      <div className="text-[20px] font-extrabold text-navy">{scanProgress.scanned}</div>
                      <div className="text-[11px] text-muted font-medium">Gescand</div>
                    </div>
                    <div className="bg-status-green-pale border border-status-green-mid rounded-lg px-3.5 py-3 text-center">
                      <div className="text-[20px] font-extrabold text-status-green">{scanProgress.created}</div>
                      <div className="text-[11px] text-status-green font-medium">Nieuw</div>
                    </div>
                    <div className="bg-bg border border-border rounded-lg px-3.5 py-3 text-center">
                      <div className="text-[20px] font-extrabold text-muted">{scanProgress.duplicates}</div>
                      <div className="text-[11px] text-muted font-medium">Duplicaten</div>
                    </div>
                  </div>
                )}

                {scanning && (
                  <button onClick={() => { abortRef.current = true }} className="w-full mt-3 px-3 py-2.5 rounded-lg border border-border text-[12.5px] font-semibold text-muted hover:text-navy hover:border-border-strong transition-colors">
                    Stop scan
                  </button>
                )}
              </div>
            )}

            {/* Scan error */}
            {scanError && (
              <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-status-red-pale border border-status-red-mid">
                <AlertCircle className="w-4 h-4 text-status-red flex-shrink-0 mt-0.5" />
                <span className="text-[12.5px] font-medium text-status-red">{scanError}</span>
              </div>
            )}

            {/* Scan complete */}
            {scanDone && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-4 text-[14px] font-bold text-status-green">
                  <CheckCircle2 className="w-5 h-5" /> Scan compleet!
                </div>
                <button
                  onClick={onComplete}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-lg bg-navy text-white text-[14px] font-bold hover:bg-navy-light transition-colors"
                >
                  Ga naar mijn dashboard <ArrowRight className="w-4.5 h-4.5" />
                </button>
              </div>
            )}

            {/* Skip option */}
            {!scanning && !scanDone && (
              <button onClick={onComplete} className="w-full mt-3 text-[12.5px] text-muted font-semibold hover:text-navy transition-colors text-center py-2">
                Overslaan — ik scan later
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
