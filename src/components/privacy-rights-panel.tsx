'use client';

import { useState, useEffect } from 'react';
import { Eye, Trash2, PenLine, Pause, Download, Ban, ToggleLeft, Loader2, CheckCircle2, Clock, X } from 'lucide-react';
import { isLocale, type Locale } from '@/i18n/locale-meta';
import { pick } from '@/lib/i18n-pick';

interface Connection {
  type: 'gmail' | 'outlook' | 'bank' | 'b2b';
  label: string;
  id?: string;
}

interface GdprRequest {
  id: string;
  request_type: string;
  status: string;
  created_at: string;
}

export default function PrivacyRightsPanel() {
  const [lang, setLang] = useState<Locale>('nl');

  useEffect(() => {
    const htmlLang = document.documentElement.lang;
    if (isLocale(htmlLang)) setLang(htmlLang);
  }, []);

  const T = pick(lang, {
    nl: {
      title: 'Recht op inzage',
      downloadBtn: 'Download mijn gegevens',
      downloadDone: 'Je gegevens zijn gedownload.',
      downloadFail: 'Download mislukt. Probeer het opnieuw.',
      consent: 'Toestemming intrekken',
      consentDesc: 'Kies welke koppelingen je wilt verbreken',
      consentView: 'Bekijk koppelingen',
      consentNone: 'Geen actieve koppelingen.',
      consentBtn: 'koppeling',
      consentBtnPlural: 'koppelingen',
      consentVerb: 'verbreken',
      correction: 'Recht op correctie',
      correctionDesc: 'Laat onjuiste gegevens aanpassen',
      restriction: 'Recht op beperking',
      restrictionDesc: 'Pauzeer de verwerking van je gegevens',
      objection: 'Recht op bezwaar',
      objectionDesc: 'Maak bezwaar tegen verwerking',
      erasure: 'Recht op verwijdering',
      erasureDesc: 'Verwijder je account en alle gegevens permanent',
      start: 'Verzoek starten',
      submit: 'Verzoek indienen',
      cancel: 'Annuleren',
      placeholder: 'Omschrijf je verzoek (optioneel)...',
      auto: 'Automatisch',
      direct: 'Direct uitvoeren',
      history: 'Eerdere verzoeken',
      historyView: 'Bekijk eerdere verzoeken',
      historyNone: 'Geen eerdere verzoeken.',
      done: 'Afgerond',
      processing: 'In behandeling',
      notShared: 'Nooit gedeeld: banktransacties, e-mails, community-posts',
      noPayments: 'Organisatie kan geen betalingen namens jou doen',
      downloadLabel: 'Download al je gegevens als JSON-bestand',
    },
    en: {
      title: 'Right of access',
      downloadBtn: 'Download my data',
      downloadDone: 'Your data has been downloaded.',
      downloadFail: 'Download failed. Please try again.',
      consent: 'Withdraw consent',
      consentDesc: 'Choose which connections to disconnect',
      consentView: 'View connections',
      consentNone: 'No active connections.',
      consentBtn: 'connection',
      consentBtnPlural: 'connections',
      consentVerb: 'disconnect',
      correction: 'Right to rectification',
      correctionDesc: 'Have incorrect data corrected',
      restriction: 'Right to restriction',
      restrictionDesc: 'Pause the processing of your data',
      objection: 'Right to object',
      objectionDesc: 'Object to processing of your data',
      erasure: 'Right to erasure',
      erasureDesc: 'Delete your account and all data permanently',
      start: 'Start request',
      submit: 'Submit request',
      cancel: 'Cancel',
      placeholder: 'Describe your request (optional)...',
      auto: 'Automatic',
      direct: 'Execute directly',
      history: 'Previous requests',
      historyView: 'View previous requests',
      historyNone: 'No previous requests.',
      done: 'Completed',
      processing: 'In progress',
      notShared: 'Never shared: bank transactions, emails, community posts',
      noPayments: 'Organisation cannot make payments on your behalf',
      downloadLabel: 'Download all your data as a JSON file',
    },
    pl: {
      title: 'Prawo dostępu',
      downloadBtn: 'Pobierz moje dane',
      downloadDone: 'Twoje dane zostały pobrane.',
      downloadFail: 'Pobieranie nie powiodło się. Spróbuj ponownie.',
      consent: 'Wycofaj zgodę',
      consentDesc: 'Wybierz, które połączenia chcesz rozłączyć',
      consentView: 'Zobacz połączenia',
      consentNone: 'Brak aktywnych połączeń.',
      consentBtn: 'połączenie',
      consentBtnPlural: 'połączenia',
      consentVerb: 'rozłącz',
      correction: 'Prawo do sprostowania',
      correctionDesc: 'Popraw nieprawidłowe dane',
      restriction: 'Prawo do ograniczenia',
      restrictionDesc: 'Wstrzymaj przetwarzanie swoich danych',
      objection: 'Prawo do sprzeciwu',
      objectionDesc: 'Sprzeciw się przetwarzaniu danych',
      erasure: 'Prawo do usunięcia',
      erasureDesc: 'Usuń swoje konto i wszystkie dane na stałe',
      start: 'Rozpocznij wniosek',
      submit: 'Złóż wniosek',
      cancel: 'Anuluj',
      placeholder: 'Opisz swój wniosek (opcjonalnie)...',
      auto: 'Automatycznie',
      direct: 'Wykonaj od razu',
      history: 'Wcześniejsze wnioski',
      historyView: 'Zobacz wcześniejsze wnioski',
      historyNone: 'Brak wcześniejszych wniosków.',
      done: 'Zakończone',
      processing: 'W trakcie',
      notShared: 'Nigdy nie udostępniane: transakcje bankowe, e-maile, posty społeczności',
      noPayments: 'Organizacja nie może dokonywać płatności w twoim imieniu',
      downloadLabel: 'Pobierz wszystkie swoje dane jako plik JSON',
    },
    tr: {
      title: 'Erişim hakkı',
      downloadBtn: 'Verilerimi indir',
      downloadDone: 'Verilerin indirildi.',
      downloadFail: 'İndirme başarısız. Lütfen tekrar dene.',
      consent: 'İzni geri çek',
      consentDesc: 'Hangi bağlantıları kesmek istediğini seç',
      consentView: 'Bağlantıları gör',
      consentNone: 'Aktif bağlantı yok.',
      consentBtn: 'bağlantı',
      consentBtnPlural: 'bağlantı',
      consentVerb: 'kes',
      correction: 'Düzeltme hakkı',
      correctionDesc: 'Yanlış verileri düzelttir',
      restriction: 'Kısıtlama hakkı',
      restrictionDesc: 'Verilerinin işlenmesini duraklat',
      objection: 'İtiraz hakkı',
      objectionDesc: 'Verilerinin işlenmesine itiraz et',
      erasure: 'Silme hakkı',
      erasureDesc: 'Hesabını ve tüm verilerini kalıcı olarak sil',
      start: 'Talep başlat',
      submit: 'Talebi gönder',
      cancel: 'İptal',
      placeholder: 'Talebini açıkla (isteğe bağlı)...',
      auto: 'Otomatik',
      direct: 'Doğrudan uygula',
      history: 'Önceki talepler',
      historyView: 'Önceki talepleri gör',
      historyNone: 'Önceki talep yok.',
      done: 'Tamamlandı',
      processing: 'İşleniyor',
      notShared: 'Asla paylaşılmaz: banka işlemleri, e-postalar, topluluk gönderileri',
      noPayments: 'Kuruluş senin adına ödeme yapamaz',
      downloadLabel: 'Tüm verilerini JSON dosyası olarak indir',
    },
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: string; message: string } | null>(null);
  const [details, setDetails] = useState('');
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [history, setHistory] = useState<GdprRequest[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [selectedDisconnects, setSelectedDisconnects] = useState<Set<string>>(new Set());

  useEffect(() => { loadConnections(); }, []);

  // Load connections and history together from GDPR endpoint
  async function loadConnections() {
    if (connectionsLoaded) return;
    try {
      const res = await fetch('/api/gdpr');
      if (res.ok) {
        const data = await res.json();
        setConnections((data.connections || []).map((c: any) => ({
          type: c.type,
          label: c.label,
          id: c.id,
        })));
        setHistory(data.requests || []);
        setHistoryLoaded(true);
      }
    } catch {}
    setConnectionsLoaded(true);
  }

  async function handleExport() {
    setLoading('export');
    try {
      const res = await fetch('/api/settings/export', { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const fileName = `paywatch-export-${new Date().toISOString().slice(0, 10)}.json`;

      if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName)] })) {
        await navigator.share({
          title: 'PayWatch Data Export',
          files: [new File([blob], fileName, { type: 'application/json' })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }

      // Log the GDPR request
      await fetch('/api/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'inzage' }),
      });
      setResult({ type: 'inzage', message: 'Je gegevens zijn gedownload.' });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setResult({ type: 'inzage', message: 'Download mislukt. Probeer het opnieuw.' });
      }
    }
    setLoading(null);
  }

  async function handleDisconnect() {
    if (selectedDisconnects.size === 0) return;
    setLoading('disconnect');

    try {
      const res = await fetch('/api/gdpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'toestemming_intrekken', details: Array.from(selectedDisconnects).join(', ') }),
      });
      const data = await res.json();
      setResult({ type: 'toestemming_intrekken', message: data.message || 'Koppelingen verwijderd.' });
      setSelectedDisconnects(new Set());
      setConnectionsLoaded(false); // reload
    } catch {
      setResult({ type: 'toestemming_intrekken', message: 'Er ging iets mis.' });
    }
    setLoading(null);
  }

  async function submitRequest(type: string) {
    if (type === 'verwijdering') {
      if (!confirm('Dit registreert een verwijderingsverzoek. Ga daarna naar de onderkant van Instellingen om je account definitief te verwijderen.')) return;
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
      loadHistory();
    } catch {
      setResult({ type, message: 'Er ging iets mis. Probeer het later opnieuw.' });
    }
    setLoading(null);
  }

  async function loadHistory() {
    if (!connectionsLoaded) {
      await loadConnections(); // loads both connections and history
      return;
    }
    try {
      const res = await fetch('/api/gdpr');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.requests || []);
      }
    } catch {}
    setHistoryLoaded(true);
  }

  function toggle(key: string) {
    setSelectedDisconnects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {/* ── Inzage: direct download ── */}
      <div className="rounded-xl border border-pw-border bg-pw-surface p-4">
        <div className="flex items-start gap-3">
          <Eye className="w-5 h-5 text-pw-blue flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-pw-navy">{T.title}</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{T.auto}</span>
            </div>
            <p className="text-[12px] text-pw-muted mt-0.5">{T.downloadLabel}</p>
            <button onClick={handleExport} disabled={loading === 'export'} className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-pw-blue active:scale-95 disabled:opacity-50">
              {loading === 'export' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              Download mijn gegevens
            </button>
            {result?.type === 'inzage' && <ResultBadge message={result.message} />}
          </div>
        </div>
      </div>

      {/* ── Toestemming intrekken: per connection ── */}
      <div className="rounded-xl border border-pw-border bg-pw-surface p-4">
        <div className="flex items-start gap-3">
          <ToggleLeft className="w-5 h-5 text-pw-blue flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold text-pw-navy">{T.consent}</h3>
            <p className="text-[12px] text-pw-muted mt-0.5">{T.consentDesc}</p>

            {!connectionsLoaded ? (
              <button onClick={loadConnections} className="mt-2 text-[12px] font-medium text-pw-blue">{T.consentView}</button>
            ) : connections.length === 0 ? (
              <p className="mt-2 text-[12px] text-pw-muted">{T.consentNone}</p>
            ) : (
              <div className="mt-3 space-y-2">
                {connections.map((conn, i) => {
                  const key = `${conn.type}-${conn.id || i}`;
                  const checked = selectedDisconnects.has(key);
                  return (
                    <label key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-pw-border bg-pw-bg cursor-pointer active:scale-[0.98]">
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} className="w-4 h-4 rounded border-pw-border text-pw-blue accent-pw-blue" />
                      <span className="text-[13px] text-pw-text">{conn.label}</span>
                    </label>
                  );
                })}
                {selectedDisconnects.size > 0 && (
                  <button onClick={handleDisconnect} disabled={loading === 'disconnect'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 text-[12px] font-medium rounded-lg border border-red-200 active:scale-95 disabled:opacity-50 w-full justify-center">
                    {loading === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    {selectedDisconnects.size} {selectedDisconnects.size > 1 ? T.consentBtnPlural : T.consentBtn} {T.consentVerb}
                  </button>
                )}
              </div>
            )}
            {result?.type === 'toestemming_intrekken' && <ResultBadge message={result.message} />}
          </div>
        </div>
      </div>

      {/* ── Manual rights ── */}
      {[
        { type: 'rectificatie', icon: PenLine, label: 'Recht op correctie', desc: 'Laat onjuiste gegevens aanpassen' },
        { type: 'beperking', icon: Pause, label: 'Recht op beperking', desc: 'Pauzeer de verwerking van je gegevens' },
        { type: 'bezwaar', icon: Ban, label: 'Recht op bezwaar', desc: 'Maak bezwaar tegen verwerking' },
        { type: 'verwijdering', icon: Trash2, label: 'Recht op verwijdering', desc: 'Verwijder je account en alle gegevens permanent' },
      ].map(({ type, icon: Icon, label, desc }) => (
        <div key={type} className="rounded-xl border border-pw-border bg-pw-surface p-4">
          <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 text-pw-blue flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1">
              <h3 className="text-[14px] font-semibold text-pw-navy">{label}</h3>
              <p className="text-[12px] text-pw-muted mt-0.5">{desc}</p>

              {showDetails === type ? (
                <div className="mt-3 space-y-2">
                  <textarea value={details} onChange={(e) => setDetails(e.target.value)}
                    placeholder={T.placeholder}
                    className="w-full rounded-lg border border-pw-border bg-pw-bg px-3 py-2 text-[13px] text-pw-text placeholder:text-pw-muted/50 resize-none" rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => submitRequest(type)} disabled={loading === type}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-pw-blue text-white text-[12px] font-medium rounded-lg disabled:opacity-50">
                      {loading === type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Verzoek indienen
                    </button>
                    <button onClick={() => { setShowDetails(null); setDetails(''); }} className="px-3 py-1.5 text-[12px] text-pw-muted">{T.cancel}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDetails(type)} disabled={loading === type}
                  className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-pw-blue active:scale-95 disabled:opacity-50">
                  Verzoek starten
                </button>
              )}
              {result?.type === type && <ResultBadge message={result.message} />}
            </div>
          </div>
        </div>
      ))}

      {/* ── Request history ── */}
      <div className="pt-4">
        {!historyLoaded ? (
          <button onClick={loadHistory} className="text-[12px] text-pw-blue font-medium">{T.historyView}</button>
        ) : history.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-[13px] font-semibold text-pw-navy">{T.history}</h3>
            {history.map((req) => (
              <div key={req.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-pw-bg text-[12px]">
                <Clock className="w-3.5 h-3.5 text-pw-muted flex-shrink-0" />
                <span className="text-pw-text font-medium capitalize">{req.request_type.replace('_', ' ')}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                  req.status === 'processing' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {req.status === 'completed' ? 'Afgerond' : req.status === 'processing' ? 'In behandeling' : req.status}
                </span>
                <span className="text-pw-muted">{new Date(req.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-pw-muted">{T.historyNone}</p>
        )}
      </div>
    </div>
  );
}

function ResultBadge({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[12px] text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
