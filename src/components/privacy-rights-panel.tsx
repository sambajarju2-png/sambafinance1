'use client';

import { useState } from 'react';
import { Eye, Trash2, PenLine, Pause, Download, Ban, ToggleLeft, Loader2, CheckCircle2, Clock } from 'lucide-react';

const RIGHTS = [
  { type: 'inzage', icon: Eye, label: 'Recht op inzage', desc: 'Bekijk welke gegevens we van je hebben', auto: true },
  { type: 'overdracht', icon: Download, label: 'Recht op overdracht', desc: 'Download al je gegevens in JSON-formaat', auto: true },
  { type: 'toestemming_intrekken', icon: ToggleLeft, label: 'Toestemming intrekken', desc: 'Ontkoppel alle koppelingen (Gmail, bank, B2B)', auto: true },
  { type: 'rectificatie', icon: PenLine, label: 'Recht op correctie', desc: 'Laat onjuiste gegevens aanpassen', auto: false },
  { type: 'beperking', icon: Pause, label: 'Recht op beperking', desc: 'Pauzeer de verwerking van je gegevens', auto: false },
  { type: 'bezwaar', icon: Ban, label: 'Recht op bezwaar', desc: 'Maak bezwaar tegen verwerking', auto: false },
  { type: 'verwijdering', icon: Trash2, label: 'Recht op verwijdering', desc: 'Verwijder je account en alle gegevens permanent', auto: false },
] as const;

interface GdprRequest {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export default function PrivacyRightsPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);
  const [details, setDetails] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [history, setHistory] = useState<GdprRequest[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  async function loadHistory() {
    try {
      const res = await fetch('/api/gdpr');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.requests || []);
      }
    } catch {}
    setHistoryLoaded(true);
  }

  async function submitRequest(type: string) {
    // Confirmation for destructive actions
    if (type === 'toestemming_intrekken') {
      if (!confirm('Weet je zeker dat je alle koppelingen wilt verbreken? Gmail, Outlook, bankverbinding en B2B-verbindingen worden losgekoppeld.')) return;
    }
    if (type === 'verwijdering') {
      if (!confirm('Dit verwijdert je account permanent. Ga naar Instellingen om je account te verwijderen, of bevestig hier om een verwijderingsverzoek in te dienen.')) return;
    }

    setLoading(type);
    setResult(null);

    try {
      const res = await fetch('/api/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details: details || undefined }),
      });
      const data = await res.json();
      setResult({ type, message: data.message || 'Verzoek ingediend.' });
      setShowDetails(null);
      setDetails('');
      // Reload history
      loadHistory();
    } catch {
      setResult({ type, message: 'Er ging iets mis. Probeer het later opnieuw.' });
    }
    setLoading(null);
  }

  return (
    <div className="space-y-3">
      {RIGHTS.map(({ type, icon: Icon, label, desc, auto }) => (
        <div key={type} className="rounded-xl border border-pw-border bg-pw-surface p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Icon className="w-5 h-5 text-pw-blue" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-pw-navy">{label}</h3>
                {auto && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">Automatisch</span>
                )}
              </div>
              <p className="text-[12px] text-pw-muted mt-0.5">{desc}</p>

              {/* Expandable details for manual types */}
              {showDetails === type ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Omschrijf je verzoek (optioneel)..."
                    className="w-full rounded-lg border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text placeholder:text-pw-muted/50 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitRequest(type)}
                      disabled={loading === type}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-pw-blue text-white text-[12px] font-medium rounded-lg disabled:opacity-50"
                    >
                      {loading === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Verzoek indienen
                    </button>
                    <button
                      onClick={() => { setShowDetails(null); setDetails(''); }}
                      className="px-3 py-1.5 text-[12px] text-pw-muted"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => auto ? submitRequest(type) : setShowDetails(type)}
                  disabled={loading === type}
                  className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-pw-blue active:scale-95 disabled:opacity-50"
                >
                  {loading === type ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {auto ? 'Direct uitvoeren' : 'Verzoek starten'}
                </button>
              )}

              {/* Result message */}
              {result?.type === type && (
                <div className="mt-2 flex items-start gap-1.5 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{result.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Request history */}
      <div className="pt-4">
        {!historyLoaded ? (
          <button onClick={loadHistory} className="text-[12px] text-pw-blue font-medium">
            Bekijk eerdere verzoeken
          </button>
        ) : history.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-[13px] font-semibold text-pw-navy">Eerdere verzoeken</h3>
            {history.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-pw-bg text-[12px]">
                <Clock className="w-3.5 h-3.5 text-pw-muted flex-shrink-0" />
                <span className="text-pw-text font-medium capitalize">{req.request_type.replace('_', ' ')}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                  req.status === 'processing' ? 'bg-amber-50 text-amber-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {req.status === 'completed' ? 'Afgerond' : req.status === 'processing' ? 'In behandeling' : req.status}
                </span>
                <span className="text-pw-muted">
                  {new Date(req.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-pw-muted">Geen eerdere verzoeken.</p>
        )}
      </div>
    </div>
  );
}
