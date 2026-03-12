'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CreditCard, Mail, Key, Scan, Loader2, CheckCircle2, ExternalLink, ArrowRight, Inbox, Zap, RefreshCw } from 'lucide-react'

interface OnboardingPanelProps {
  accessToken: string
  onComplete: () => Promise<void>
}

export default function OnboardingPanel({ accessToken, onComplete }: OnboardingPanelProps) {
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [gmailError, setGmailError] = useState<string | null>(null)
  const [gmailChecking, setGmailChecking] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [apiKeySaving, setApiKeySaving] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [apiKeyTesting, setApiKeyTesting] = useState(false)
  const [apiKeyTestResult, setApiKeyTestResult] = useState<'ok' | 'fail' | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ scanned: 0, created: 0, batches: 0 })
  const [scanDone, setScanDone] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const abortRef = useRef(false)

  const getHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }, [accessToken])

  // Gmail status check function — can be called manually or from effect
  const checkGmailStatus = useCallback(async () => {
    if (!accessToken) {
      setDebugInfo('Wacht op authenticatie...')
      return false
    }
    setGmailChecking(true)
    setDebugInfo(`Controleer Gmail status...`)
    try {
      const res: Response = await fetch(`/api/gmail/status?_t=${Date.now()}`, {
        headers: getHeaders(),
        cache: 'no-store',
      })
      const data: { accounts?: Array<{ email: string; connected: boolean; expired: boolean }>; error?: string; _debug?: { userId: string; rowCount: number; dataLen: number } } = await res.json()
      setDebugInfo(`Status: ${res.status}, Accounts: ${data.accounts?.length || 0}, userId: ${data._debug?.userId || 'unknown'}, rows: ${data._debug?.rowCount ?? '?'}`)

      if (!res.ok) {
        setGmailError(`Status check mislukt (${res.status}): ${data.error || 'Unknown'}`)
        return false
      }
      if (data.accounts && data.accounts.length > 0) {
        setGmailConnected(true)
        setGmailEmail(data.accounts[0].email)
        setGmailError(null)
        return true
      }
      return false
    } catch (err) {
      setDebugInfo(`Fout: ${err instanceof Error ? err.message : 'Unknown'}`)
      setGmailError('Kon Gmail status niet ophalen')
      return false
    } finally {
      setGmailChecking(false)
    }
  }, [accessToken, getHeaders])

  // Check URL params for Gmail callback result
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const gmail = params.get('gmail')
    if (error) {
      const detail = params.get('detail') || ''
      setGmailError(`Gmail fout: ${error}${detail ? ` (${detail})` : ''}`)
    }
    if (gmail === 'connected') {
      setDebugInfo('Gmail callback: connected param detected')
    }
    // Clean URL params
    if (error || gmail) {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Poll for Gmail status on mount and whenever accessToken changes
  useEffect(() => {
    if (!accessToken || gmailConnected) return

    // Check immediately
    checkGmailStatus()

    // Also poll every 3 seconds for 30 seconds (handles redirect timing)
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      if (attempts > 10 || gmailConnected) {
        clearInterval(interval)
        return
      }
      const found = await checkGmailStatus()
      if (found) clearInterval(interval)
    }, 3000)

    return () => clearInterval(interval)
  }, [accessToken, gmailConnected, checkGmailStatus])

  // Check if API key already saved
  useEffect(() => {
    if (!accessToken) return
    fetch(`/api/settings?_t=${Date.now()}`, { headers: getHeaders(), cache: 'no-store' })
      .then(r => r.json())
      .then((d: { data?: { anthropic_api_key?: string } }) => {
        if (d.data?.anthropic_api_key) {
          setApiKey(d.data.anthropic_api_key)
          setApiKeySaved(true)
        }
      })
      .catch(() => {})
  }, [accessToken, getHeaders])

  async function handleSaveApiKey(): Promise<void> {
    if (!apiKey.trim()) return
    setApiKeySaving(true)
    try {
      const r: Response = await fetch('/api/settings', {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({ anthropic_api_key: apiKey.trim() }),
      })
      if (r.ok) { setApiKeySaved(true) }
    } catch {} finally { setApiKeySaving(false) }
  }

  async function handleTestApiKey(): Promise<void> {
    setApiKeyTesting(true)
    setApiKeyTestResult(null)
    try {
      const r: Response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      })
      setApiKeyTestResult(r.ok ? 'ok' : 'fail')
    } catch {
      setApiKeyTestResult('fail')
    } finally { setApiKeyTesting(false) }
  }

  async function handleStartScan(): Promise<void> {
    setScanning(true)
    setScanDone(false)
    setScanError(null)
    abortRef.current = false
    setScanProgress({ scanned: 0, created: 0, batches: 0 })

    let pageToken: string | undefined = undefined
    let totalScanned = 0
    let totalCreated = 0
    let batchCount = 0

    try {
      while (!abortRef.current && totalScanned < 100) {
        const r: Response = await fetch('/api/gmail/scan', {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ mode: 'initial', pageToken }),
        })
        const d: { scanned?: number; created?: number; done?: boolean; nextPageToken?: string; error?: string } = await r.json()
        if (!r.ok) { setScanError(d.error || 'Scan mislukt'); break }
        totalScanned += d.scanned || 0
        totalCreated += d.created || 0
        batchCount++
        setScanProgress({ scanned: totalScanned, created: totalCreated, batches: batchCount })
        if (d.done || !d.nextPageToken) { setScanDone(true); break }
        pageToken = d.nextPageToken
      }
      if (!abortRef.current) setScanDone(true)
    } catch { setScanError('Scan mislukt — controleer je verbinding') }
    finally { setScanning(false) }
  }

  async function handleFinish(): Promise<void> {
    await onComplete()
  }

  const canScan = gmailConnected && apiKeySaved

  return (
    <div className="max-w-[520px] mx-auto py-10 px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <div className="w-11 h-11 bg-gradient-to-br from-brand-blue-hover to-blue-700 rounded-[11px] flex items-center justify-center shadow-[0_2px_12px_rgba(37,99,235,.4)]">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold text-navy tracking-tight">Welkom bij PayWatch</h1>
        <p className="text-[14px] text-muted mt-1.5">Koppel je Gmail en laat AI je facturen scannen</p>
      </div>

      {/* Step 1: Connect Gmail */}
      <div className={`bg-surface border rounded-card shadow-card overflow-hidden mb-4 ${gmailConnected ? 'border-status-green-mid' : 'border-border'}`}>
        <div className="px-5 py-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${gmailConnected ? 'bg-status-green-pale' : 'bg-brand-blue-pale'}`}>
            {gmailChecking ? <Loader2 className="w-4 h-4 animate-spin text-brand-blue" /> : gmailConnected ? <CheckCircle2 className="w-4 h-4 text-status-green" /> : <Mail className="w-4 h-4 text-brand-blue" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-navy">1. Gmail koppelen</div>
            {gmailConnected ? (
              <div className="text-[12.5px] text-status-green font-semibold mt-0.5 truncate">✓ Verbonden met {gmailEmail}</div>
            ) : gmailChecking ? (
              <div className="text-[12.5px] text-muted mt-0.5">Controleren...</div>
            ) : (
              <div className="text-[12.5px] text-muted mt-0.5">Koppel je inbox om facturen automatisch te detecteren</div>
            )}
          </div>
          {!gmailConnected && !gmailChecking && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={checkGmailStatus}
                className="p-2 rounded-lg border border-border text-muted hover:text-navy hover:border-border-strong transition-colors"
                title="Opnieuw controleren"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { window.location.href = `/api/gmail/connect?token=${encodeURIComponent(accessToken)}` }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-[12.5px] font-bold hover:bg-navy-light transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" /> Koppelen
              </button>
            </div>
          )}
        </div>
        {gmailError && (
          <div className="mx-5 mb-4 px-3.5 py-2.5 rounded-lg text-[12px] font-medium border bg-status-red-pale border-status-red-mid text-status-red">
            {gmailError}
          </div>
        )}
        {debugInfo && !gmailConnected && (
          <div className="mx-5 mb-4 px-3.5 py-2 rounded-lg text-[11px] font-mono border bg-bg border-border text-muted">
            Debug: {debugInfo} | Token: {accessToken ? `${accessToken.substring(0, 20)}...` : 'EMPTY'}
          </div>
        )}
      </div>

      {/* Step 2: API Key */}
      <div className={`bg-surface border rounded-card shadow-card overflow-hidden mb-4 ${apiKeySaved ? 'border-status-green-mid' : 'border-border'}`}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${apiKeySaved ? 'bg-status-green-pale' : 'bg-brand-blue-pale'}`}>
              {apiKeySaved ? <CheckCircle2 className="w-4 h-4 text-status-green" /> : <Key className="w-4 h-4 text-brand-blue" />}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-navy">2. Claude AI API Key</div>
              <div className="text-[12.5px] text-muted mt-0.5">
                {apiKeySaved ? '✓ API key opgeslagen' : 'Nodig voor het scannen van PDF facturen'}
              </div>
            </div>
          </div>
          {!apiKeySaved ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-light" />
                  <input
                    type="password" value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-[13px] text-navy bg-surface outline-none focus:border-brand-blue-hover transition-colors font-mono placeholder:font-sans placeholder:text-muted-light"
                  />
                </div>
                <button onClick={handleSaveApiKey} disabled={apiKeySaving || !apiKey.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-navy text-white text-[12.5px] font-bold hover:bg-navy-light disabled:opacity-50 transition-colors whitespace-nowrap">
                  {apiKeySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Opslaan'}
                </button>
              </div>
              <p className="text-[11px] text-muted-light mt-2">
                Maak een key aan op{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-brand-blue font-semibold inline-flex items-center gap-0.5">
                  console.anthropic.com <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={handleTestApiKey} disabled={apiKeyTesting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-[12px] font-semibold text-muted hover:text-navy hover:border-border-strong transition-colors">
                {apiKeyTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Test API key
              </button>
              {apiKeyTestResult === 'ok' && <span className="text-[12px] text-status-green font-semibold">✓ Werkt!</span>}
              {apiKeyTestResult === 'fail' && <span className="text-[12px] text-status-red font-semibold">✗ Key werkt niet</span>}
              <button onClick={() => { setApiKeySaved(false); setApiKeyTestResult(null) }}
                className="ml-auto text-[11px] text-muted hover:text-navy font-semibold transition-colors">
                Wijzigen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Scan */}
      <div className={`bg-surface border rounded-card shadow-card overflow-hidden mb-4 ${scanDone ? 'border-status-green-mid' : 'border-border'}`}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${scanDone ? 'bg-status-green-pale' : 'bg-brand-blue-pale'}`}>
              {scanDone ? <CheckCircle2 className="w-4 h-4 text-status-green" /> : <Scan className="w-4 h-4 text-brand-blue" />}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-navy">3. Inbox scannen</div>
              <div className="text-[12.5px] text-muted mt-0.5">
                {scanDone ? `✓ ${scanProgress.created} facturen gevonden` : 'Scan je inbox (laatste 14 dagen)'}
              </div>
            </div>
          </div>

          {!scanning && !scanDone && (
            <button onClick={handleStartScan} disabled={!canScan}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-blue text-white text-[13px] font-bold hover:bg-brand-blue-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Inbox className="w-4 h-4" /> Start scan
            </button>
          )}

          {(scanning || scanDone) && (
            <div className="mt-2 px-3.5 py-3 bg-bg border border-border rounded-lg">
              <div className="flex items-center gap-3 text-[12.5px]">
                {scanning && <Loader2 className="w-4 h-4 animate-spin text-brand-blue flex-shrink-0" />}
                <span className="text-muted"><strong className="text-navy">{scanProgress.scanned}</strong> e-mails gescand</span>
                <span className="text-status-green font-bold">{scanProgress.created} facturen</span>
              </div>
              {scanning && (
                <>
                  <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-brand-blue rounded-full transition-all duration-500" style={{ width: `${Math.min((scanProgress.scanned / 100) * 100, 100)}%` }} />
                  </div>
                  <button onClick={() => { abortRef.current = true }} className="mt-2 text-[11px] text-muted hover:text-status-red font-semibold transition-colors">Stoppen</button>
                </>
              )}
              {scanDone && <div className="mt-1.5 text-[12px] font-semibold text-status-green">✓ Eerste scan compleet</div>}
            </div>
          )}

          {scanError && (
            <div className="mt-2 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium border bg-status-red-pale border-status-red-mid text-status-red">{scanError}</div>
          )}

          {!gmailConnected && <p className="text-[11.5px] text-muted-light mt-2">Koppel eerst je Gmail (stap 1)</p>}
          {gmailConnected && !apiKeySaved && <p className="text-[11.5px] text-muted-light mt-2">Voeg eerst je API key toe (stap 2)</p>}
        </div>
      </div>

      {/* Finish */}
      {scanDone && (
        <button onClick={handleFinish} className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-card bg-navy text-white text-[14px] font-bold hover:bg-navy-light transition-colors shadow-card">
          Ga naar je dashboard <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* Skip */}
      {!scanDone && (
        <button onClick={handleFinish} className="w-full text-center text-[12.5px] text-muted hover:text-navy font-semibold transition-colors mt-4 py-2">
          Overslaan — ik voeg later handmatig facturen toe
        </button>
      )}
    </div>
  )
}
