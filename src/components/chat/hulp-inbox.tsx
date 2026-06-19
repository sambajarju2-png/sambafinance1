'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Building2, Users, CircleDot, UserCheck, Phone, Loader2 } from 'lucide-react';
import { pick } from '@/lib/i18n-pick';
import { DEFAULT_CONSENT_SCOPES, consentScopeLabels } from '@/lib/consent-scopes';
import dynamic from 'next/dynamic';

const CoachCallRoom = dynamic(() => import('@/components/chat/coach-call-room'), { ssr: false });

interface Thread {
  thread_id: string;
  sender_name: string;
  sender_type: string;
  last_message: string;
  last_at: string;
  unread: number;
  total: number;
}

interface Message {
  id: string;
  sender_type: string;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
  message_type?: string;
  metadata?: { room_name?: string; expires_at?: string } | null;
}

function timeAgo(date: string, lang: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return pick(lang, { nl: 'nu', en: 'now', pl: 'teraz', tr: 'şimdi', fr: "à l'instant", ar: 'الآن' });
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function senderIcon(type: string) {
  if (type === 'gemeente') return <Building2 className="h-4 w-4" strokeWidth={1.5} />;
  if (type === 'hulpinstantie') return <Users className="h-4 w-4" strokeWidth={1.5} />;
  if (type === 'coach') return <UserCheck className="h-4 w-4" strokeWidth={1.5} />;
  return <Users className="h-4 w-4" strokeWidth={1.5} />;
}

function senderColor(type: string) {
  if (type === 'gemeente') return 'bg-pw-blue/10 text-pw-blue';
  if (type === 'hulpinstantie') return 'bg-pw-green/10 text-pw-green';
  if (type === 'coach') return 'bg-purple-100 text-purple-600';
  return 'bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400';
}

/* ─────────────────────────────────────────────
   THREAD LIST (inbox overview)
   ───────────────────────────────────────────── */
function ThreadList({ threads, onOpen, lang }: {
  threads: Thread[];
  onOpen: (threadId: string) => void;
  lang: string;
}) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pw-blue/10">
          <Users className="h-6 w-6 text-pw-blue" strokeWidth={1.5} />
        </div>
        <p className="text-[14px] font-medium text-pw-text dark:text-white">
          {pick(lang, { nl: 'Nog geen berichten', en: 'No messages yet', pl: 'Brak wiadomości', tr: 'Henüz mesaj yok', fr: 'Aucun message pour le moment', ar: 'لا توجد رسائل بعد' })}
        </p>
        <p className="mt-1 text-[12px] text-pw-muted max-w-[240px]">
          {pick(lang, {
            nl: 'Je vangnet buddy of hulporganisatie kan hier contact met je opnemen.',
            en: 'Your safety net buddy or help organization can reach out to you here.',
            pl: 'Twój buddy z siatki bezpieczeństwa lub organizacja pomocowa może się tu z tobą skontaktować.',
            tr: 'Güvenlik ağındaki destekçin veya yardım kuruluşu burada seninle iletişime geçebilir.', fr: "Ton soutien dans le filet de sécurité ou ton organisation d'aide peut te contacter ici.", ar: 'يمكن لداعمك في شبكة الأمان أو منظمة المساعدة التواصل معك هنا.',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-pw-border/40">
      {threads.map(thread => (
        <button
          key={thread.thread_id}
          onClick={() => onOpen(thread.thread_id)}
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-pw-border/20 active:bg-pw-border/30"
        >
          {/* Avatar */}
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${senderColor(thread.sender_type)}`}>
            {senderIcon(thread.sender_type)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-pw-text dark:text-white truncate">
                {thread.sender_name}
                {thread.sender_type === 'coach' && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-medium text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                    Coach
                  </span>
                )}
              </p>
              <span className="ml-2 flex-shrink-0 text-[11px] text-pw-muted">
                {timeAgo(thread.last_at, lang)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[12px] text-pw-muted truncate">
                {thread.last_message}
              </p>
              {thread.unread > 0 && (
                <span className="ml-2 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-pw-blue px-1.5 text-[10px] font-bold text-white">
                  {thread.unread}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   THREAD VIEW (single conversation)
   ───────────────────────────────────────────── */
function ThreadView({ threadId, onBack, lang }: {
  threadId: string;
  onBack: () => void;
  lang: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [threadName, setThreadName] = useState('');
  const [threadType, setThreadType] = useState('');
  const [activeCall, setActiveCall] = useState<{ token: string; roomName: string; livekitUrl: string } | null>(null);
  const [joiningCall, setJoiningCall] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/hulp-inbox?thread_id=${encodeURIComponent(threadId)}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        const firstOrg = (data.messages || []).find((m: Message) => m.sender_type !== 'user');
        if (firstOrg) {
          setThreadName(firstOrg.sender_name);
          setThreadType(firstOrg.sender_type);
        }
      }
    }
    load();
  }, [threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/hulp-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, content: reply.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setReply('');
      }
    } catch {}
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-pw-border/40 px-3 py-2.5" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-pw-border/30">
          <ArrowLeft className="h-5 w-5 text-pw-text dark:text-white" strokeWidth={1.5} />
        </button>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${senderColor(threadType)}`}>
          {senderIcon(threadType)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-pw-text dark:text-white truncate">{threadName}</p>
          <p className="text-[10px] text-pw-muted capitalize">{threadType || 'hulpverlener'}</p>
        </div>
      </div>

      {/* Active call overlay */}
      {activeCall && (
        <CoachCallRoom
          roomName={activeCall.roomName}
          token={activeCall.token}
          livekitUrl={activeCall.livekitUrl}
          coachName={threadName}
          onLeave={() => setActiveCall(null)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map(msg => {
          const isUser = msg.sender_type === 'user';

          // Call invite message
          if (msg.message_type === 'call_invite' && msg.metadata?.room_name) {
            const expired = msg.metadata.expires_at ? new Date(msg.metadata.expires_at) < new Date() : false;
            const roomName = msg.metadata.room_name;
            const isJoining = joiningCall === roomName;

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-pw-blue/20 bg-pw-blue/5 dark:bg-pw-blue/10 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-pw-blue flex-shrink-0" strokeWidth={2} />
                    <span className="text-[13px] font-semibold text-pw-navy dark:text-white">
                      {msg.sender_name || 'Coach'} {pick(lang, { nl: 'wil videobellen', en: 'wants to video call', pl: 'chce rozpocząć rozmowę wideo', tr: 'görüntülü görüşme yapmak istiyor', fr: 'veut passer un appel vidéo', ar: 'يريد إجراء مكالمة فيديو' })}
                    </span>
                  </div>
                  {expired ? (
                    <p className="text-[12px] text-pw-muted">{pick(lang, { nl: 'Gesprek verlopen', en: 'Call expired', pl: 'Rozmowa wygasła', tr: 'Görüşme süresi doldu', fr: 'Appel expiré', ar: 'انتهت صلاحية المكالمة' })}</p>
                  ) : (
                    <button
                      disabled={isJoining}
                      onClick={async () => {
                        setJoiningCall(roomName);
                        try {
                          const res = await fetch(`/api/call?room=${encodeURIComponent(roomName)}`);
                          if (res.ok) {
                            const data = await res.json();
                            setActiveCall({ token: data.token, roomName, livekitUrl: data.livekitUrl });
                          } else { alert(pick(lang, { nl: 'Kon gesprek niet starten.', en: 'Could not start the call.', pl: 'Nie udało się rozpocząć rozmowy.', tr: 'Görüşme başlatılamadı.', fr: "Impossible de démarrer l'appel.", ar: 'تعذّر بدء المكالمة.' })); }
                        } catch { alert(pick(lang, { nl: 'Verbindingsfout.', en: 'Connection error.', pl: 'Błąd połączenia.', tr: 'Bağlantı hatası.', fr: 'Erreur de connexion.', ar: 'خطأ في الاتصال.' })); }
                        setJoiningCall(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-pw-blue text-white text-[13px] font-medium rounded-xl active:scale-95 disabled:opacity-60"
                    >
                      {isJoining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" strokeWidth={2} />}
                      {pick(lang, { nl: 'Gesprek joinen', en: 'Join call', pl: 'Dołącz do rozmowy', tr: 'Görüşmeye katıl', fr: "Rejoindre l'appel", ar: 'انضم إلى المكالمة' })}
                    </button>
                  )}
                  <p className="text-[10px] text-pw-muted mt-2">
                    {new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          }

          // Regular text message
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                isUser
                  ? 'bg-pw-blue text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-white/5 text-pw-text dark:text-white rounded-bl-md'
              }`}>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`mt-1 text-[10px] ${isUser ? 'text-white/50' : 'text-pw-muted'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply input */}
      <div className="border-t border-pw-border/40 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendReply();
              }
            }}
            placeholder={pick(lang, { nl: 'Typ een antwoord...', en: 'Type a reply...', pl: 'Napisz odpowiedź...', tr: 'Yanıt yaz...', fr: 'Saisis une réponse...', ar: 'اكتب ردًا...' })}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-pw-border bg-pw-surface px-3 py-2 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue dark:bg-white/5 dark:text-white dark:border-pw-border/50"
          />
          <button
            onClick={sendReply}
            disabled={!reply.trim() || sending}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pw-blue text-white disabled:opacity-40 active:scale-95"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN HULP INBOX
   ───────────────────────────────────────────── */
export default function HulpInbox({ lang, onClose }: { lang: string; onClose: () => void }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Org connections state
  const [orgs, setOrgs] = useState<Array<{ organization_id: string; status: string; org: { id: string; name: string; type: string; city?: string; primary_color?: string } | null }>>([]);
  const [codeInput, setCodeInput] = useState('');
  const [showOrgConsent, setShowOrgConsent] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<{ organization_id: string; org: { name: string } | null } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [inboxRes, orgsRes] = await Promise.all([
          fetch('/api/hulp-inbox'),
          fetch('/api/org-connections'),
        ]);
        if (inboxRes.ok) {
          const data = await inboxRes.json();
          setThreads(data.threads || []);
          setTotalUnread(data.total_unread || 0);
        }
        if (orgsRes.ok) {
          const d = await orgsRes.json();
          setOrgs(d.orgs || []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [activeThread]);

  const [consentScopes, setConsentScopes] = useState({ ...DEFAULT_CONSENT_SCOPES });

  function toggleScope(key: keyof typeof consentScopes) {
    if (key === 'contact_info') return; // always required
    setConsentScopes(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function connectCode() {
    if (!codeInput.trim()) return;
    setCodeError(null);
    setShowOrgConsent(true);
  }

  async function confirmOrgConnect() {
    setCodeLoading(true); setCodeError(null); setCodeSuccess(null);
    setShowOrgConsent(false);
    const selectedScopes = Object.entries(consentScopes).filter(([, v]) => v).map(([k]) => k);
    try {
      const res = await fetch('/api/org-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: codeInput.trim(), scopes: selectedScopes }),
      });
      const d = await res.json();
      if (res.ok) {
        setCodeSuccess(d.org?.name || pick(lang, { nl: 'Organisatie', en: 'Organisation', pl: 'Organizacja', tr: 'Kuruluş', fr: 'Organisation', ar: 'المؤسسة' }));
        setCodeInput('');
        setShowCodeInput(false);
        const orgsRes = await fetch('/api/org-connections');
        if (orgsRes.ok) setOrgs((await orgsRes.json()).orgs || []);
      } else {
        setCodeError(d.error || pick(lang, { nl: 'Onbekende fout', en: 'Unknown error', pl: 'Nieznany błąd', tr: 'Bilinmeyen hata', fr: 'Erreur inconnue', ar: 'خطأ غير معروف' }));
      }
    } catch { setCodeError(pick(lang, { nl: 'Verbinding mislukt', en: 'Connection failed', pl: 'Połączenie nie powiodło się', tr: 'Bağlantı başarısız', fr: 'Échec de la connexion', ar: 'فشل الاتصال' })); }
    setCodeLoading(false);
  }

  const SCOPE_LABELS = consentScopeLabels(lang);

  // Org consent modal
  async function leaveOrg() {
    if (!leaveTarget) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await fetch('/api/org-connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: leaveTarget.organization_id }),
      });
      const d = await res.json();
      if (res.ok) {
        setLeaveTarget(null);
        const orgsRes = await fetch('/api/org-connections');
        if (orgsRes.ok) setOrgs((await orgsRes.json()).orgs || []);
      } else {
        setLeaveError(d.error || pick(lang, { nl: 'Verlaten mislukt', en: 'Could not leave', pl: 'Nie udało się opuścić', tr: 'Ayrılma başarısız', fr: 'Échec', ar: 'فشل' }));
      }
    } catch {
      setLeaveError(pick(lang, { nl: 'Verbinding mislukt', en: 'Connection failed', pl: 'Połączenie nie powiodło się', tr: 'Bağlantı başarısız', fr: 'Échec de la connexion', ar: 'فشل الاتصال' }));
    }
    setLeaving(false);
  }

  const leaveModal = leaveTarget ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-5" onClick={() => { if (!leaving) setLeaveTarget(null); }}>
      <div className="w-full max-w-sm bg-pw-surface rounded-2xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-bold text-pw-navy">
          {pick(lang, { nl: `${leaveTarget.org?.name || 'Organisatie'} verlaten?`, en: `Leave ${leaveTarget.org?.name || 'organisation'}?`, pl: `Opuścić ${leaveTarget.org?.name || 'organizację'}?`, tr: `${leaveTarget.org?.name || 'Kuruluş'} ayrıl?`, fr: `Quitter ${leaveTarget.org?.name || "l'organisation"} ?`, ar: `مغادرة ${leaveTarget.org?.name || 'المؤسسة'}؟` })}
        </h3>
        <p className="text-[13px] text-pw-muted leading-relaxed">
          {pick(lang, { nl: 'De organisatie heeft daarna geen toegang meer tot je gegevens. Je PayWatch-account en een eventueel abonnement blijven gewoon bestaan.', en: 'The organisation will no longer have access to your data. Your PayWatch account and any subscription stay exactly as they are.', pl: 'Organizacja straci dostęp do Twoich danych. Twoje konto PayWatch i ewentualna subskrypcja pozostają bez zmian.', tr: 'Kuruluşun verilerine artık erişimi olmaz. PayWatch hesabın ve varsa aboneliğin aynen kalır.', fr: "L'organisation n'aura plus accès à tes données. Ton compte PayWatch et ton éventuel abonnement restent inchangés.", ar: 'لن يكون لدى المؤسسة وصول إلى بياناتك بعد الآن. يبقى حساب PayWatch واشتراكك (إن وُجد) كما هو.' })}
        </p>
        {leaveError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-pw-red">{leaveError}</div>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={leaveOrg} disabled={leaving} className="flex-1 flex items-center justify-center gap-2 py-3 bg-pw-red text-white text-[14px] font-semibold rounded-xl active:scale-95 disabled:opacity-50">
            {leaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {pick(lang, { nl: 'Ja, verlaten', en: 'Yes, leave', pl: 'Tak, opuść', tr: 'Evet, ayrıl', fr: 'Oui, quitter', ar: 'نعم، غادر' })}
          </button>
          <button onClick={() => setLeaveTarget(null)} disabled={leaving} className="flex-1 py-3 border border-pw-border text-pw-muted text-[14px] font-semibold rounded-xl disabled:opacity-50">
            {pick(lang, { nl: 'Annuleren', en: 'Cancel', pl: 'Anuluj', tr: 'İptal', fr: 'Annuler', ar: 'إلغاء' })}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const orgConsentModal = showOrgConsent ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-5" onClick={() => setShowOrgConsent(false)}>
      <div className="w-full max-w-sm bg-pw-surface rounded-2xl shadow-xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-[16px] font-bold text-pw-navy">{pick(lang, { nl: 'Gegevens delen met organisatie', en: 'Share data with organisation', pl: 'Udostępnij dane organizacji', tr: 'Verileri kuruluşla paylaş', fr: "Partager des données avec l'organisation", ar: 'مشاركة البيانات مع المؤسسة' })}</h3>
        <p className="text-[13px] text-pw-muted leading-relaxed">
          {pick(lang, { nl: 'Kies welke gegevens je wilt delen. Je kunt dit later wijzigen via Instellingen → Privacyrechten.', en: 'Choose which data you want to share. You can change this later via Settings → Privacy rights.', pl: 'Wybierz, które dane chcesz udostępnić. Możesz to później zmienić w Ustawienia → Prawa do prywatności.', tr: 'Hangi verileri paylaşmak istediğini seç. Bunu daha sonra Ayarlar → Gizlilik hakları üzerinden değiştirebilirsin.', fr: 'Choisis les données que tu souhaites partager. Tu pourras modifier cela plus tard via Paramètres → Droits de confidentialité.', ar: 'اختر البيانات التي تريد مشاركتها. يمكنك تغيير ذلك لاحقًا عبر الإعدادات ← حقوق الخصوصية.' })}
        </p>
        <div className="rounded-xl bg-pw-bg p-3 space-y-1">
          {Object.entries(SCOPE_LABELS).map(([key, { label, desc, required }]) => (
            <label key={key} className={`flex items-start gap-3 p-2.5 rounded-lg ${required ? 'opacity-80' : 'cursor-pointer active:scale-[0.98]'}`}>
              <input
                type="checkbox"
                checked={consentScopes[key as keyof typeof consentScopes]}
                onChange={() => toggleScope(key as keyof typeof consentScopes)}
                disabled={required}
                className="mt-0.5 w-4 h-4 rounded border-pw-border text-pw-blue accent-pw-blue"
              />
              <div>
                <p className="text-[13px] text-pw-text font-medium">{label}{required ? ` (${pick(lang, { nl: 'verplicht', en: 'required', pl: 'wymagane', tr: 'zorunlu', fr: 'obligatoire', ar: 'إلزامي' })})` : ''}</p>
                <p className="text-[11px] text-pw-muted">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="rounded-xl bg-pw-bg p-3 space-y-1 text-[12px] text-pw-muted">
          <p>{pick(lang, { nl: '✗ Nooit gedeeld: banktransacties, e-mails, community posts', en: '✗ Never shared: bank transactions, emails, community posts', pl: '✗ Nigdy nieudostępniane: transakcje bankowe, e-maile, posty społeczności', tr: '✗ Asla paylaşılmaz: banka işlemleri, e-postalar, topluluk gönderileri', fr: '✗ Jamais partagé : transactions bancaires, e-mails, publications de la communauté', ar: '✗ لا تتم مشاركتها أبدًا: المعاملات البنكية، رسائل البريد، منشورات المجتمع' })}</p>
          <p>{pick(lang, { nl: '✗ Organisatie kan geen betalingen doen namens jou', en: '✗ The organisation cannot make payments on your behalf', pl: '✗ Organizacja nie może dokonywać płatności w twoim imieniu', tr: '✗ Kuruluş senin adına ödeme yapamaz', fr: "✗ L'organisation ne peut pas effectuer de paiements en ton nom", ar: '✗ لا يمكن للمؤسسة إجراء مدفوعات نيابة عنك' })}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={confirmOrgConnect}
            disabled={codeLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-pw-blue text-white text-[14px] font-semibold rounded-xl active:scale-95 disabled:opacity-50"
          >
            {codeLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {pick(lang, { nl: 'Ja, ik ga akkoord', en: 'Yes, I agree', pl: 'Tak, zgadzam się', tr: 'Evet, kabul ediyorum', fr: "Oui, j'accepte", ar: 'نعم، أوافق' })}
          </button>
          <button
            onClick={() => setShowOrgConsent(false)}
            className="flex-1 py-3 border border-pw-border text-pw-muted text-[14px] font-semibold rounded-xl"
          >
            {pick(lang, { nl: 'Annuleren', en: 'Cancel', pl: 'Anuluj', tr: 'İptal', fr: 'Annuler', ar: 'إلغاء' })}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (activeThread) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-pw-bg dark:bg-pw-navy">
        <ThreadView
          threadId={activeThread}
          onBack={() => setActiveThread(null)}
          lang={lang}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-pw-bg dark:bg-pw-navy">
      {orgConsentModal}
      {leaveModal}
      {/* Header */}
      <div className="flex items-center justify-between border-b border-pw-border/40 px-4 py-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-pw-border/30">
            <ArrowLeft className="h-5 w-5 text-pw-text dark:text-white" strokeWidth={1.5} />
          </button>
          <div>
            <h2 className="text-[15px] font-semibold text-pw-text dark:text-white">
              {pick(lang, { nl: 'Hulplijn', en: 'Help inbox', pl: 'Linia pomocy', tr: 'Yardım kutusu', fr: "Boîte d'aide", ar: 'صندوق المساعدة' })}
            </h2>
            <p className="text-[11px] text-pw-muted">
              {pick(lang, { nl: 'Berichten van je vangnet', en: 'Messages from your safety net', pl: 'Wiadomości od twojej siatki bezpieczeństwa', tr: 'Güvenlik ağından mesajlar', fr: 'Messages de ton filet de sécurité', ar: 'رسائل من شبكة الأمان الخاصة بك' })}
            </p>
          </div>
        </div>
        {totalUnread > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-pw-blue px-2 text-[11px] font-bold text-white">
            {totalUnread}
          </span>
        )}
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-pw-blue border-t-transparent" />
          </div>
        ) : (
          <ThreadList threads={threads} onOpen={setActiveThread} lang={lang} />
        )}
      </div>

      {/* ── Mijn organisaties ─────────────────── */}
      <div className="border-t border-pw-border/40 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-pw-text dark:text-white">
            {pick(lang, { nl: 'Mijn organisaties', en: 'My organisations', pl: 'Moje organizacje', tr: 'Kuruluşlarım', fr: 'Mes organisations', ar: 'مؤسساتي' })}
          </p>
          <button
            onClick={() => { setShowCodeInput(v => !v); setCodeError(null); setCodeSuccess(null); }}
            className="text-[11px] font-semibold text-pw-blue"
          >
            {pick(lang, { nl: '+ Code invoeren', en: '+ Enter code', pl: '+ Wpisz kod', tr: '+ Kod gir', fr: '+ Saisir un code', ar: '+ إدخال رمز' })}
          </button>
        </div>

        {/* Connected orgs */}
        {orgs.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {orgs.map(uo => (
              <div key={uo.organization_id} className="flex items-center gap-2 bg-pw-bg dark:bg-white/5 rounded-lg px-2.5 py-2 border border-pw-border/50">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ background: uo.org?.primary_color || '#2563EB' }}>
                  {(uo.org?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-pw-text dark:text-white leading-none truncate">{uo.org?.name}</p>
                  {uo.org?.city && <p className="text-[10px] text-pw-muted leading-none mt-0.5">{uo.org.city}</p>}
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-pw-green flex-shrink-0" />
                <button
                  onClick={() => { setLeaveError(null); setLeaveTarget(uo); }}
                  className="text-[10px] font-semibold text-pw-muted hover:text-pw-red px-2 py-1 rounded-md flex-shrink-0"
                >
                  {pick(lang, { nl: 'Verlaten', en: 'Leave', pl: 'Opuść', tr: 'Ayrıl', fr: 'Quitter', ar: 'مغادرة' })}
                </button>
              </div>
            ))}
          </div>
        )}

        {orgs.length === 0 && !showCodeInput && (
          <p className="text-[11px] text-pw-muted">
            {pick(lang, { nl: 'Nog geen organisatie gekoppeld. Heb je een uitnodigingscode? Voer die in.', en: 'No organisation connected yet. Have an invite code? Enter it above.', pl: 'Brak połączonej organizacji. Masz kod zaproszenia? Wpisz go.', tr: 'Henüz bağlı kuruluş yok. Davet kodun var mı? Yukarıya gir.', fr: "Aucune organisation connectée pour le moment. Tu as un code d'invitation ? Saisis-le ci-dessus.", ar: 'لا توجد مؤسسة مرتبطة بعد. هل لديك رمز دعوة؟ أدخله بالأعلى.' })}
          </p>
        )}

        {/* Code input */}
        {showCodeInput && (
          <div className="mt-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && connectCode()}
                placeholder={pick(lang, { nl: 'Voer uitnodigingscode in', en: 'Enter invite code', pl: 'Wpisz kod zaproszenia', tr: 'Davet kodu gir', fr: "Saisir le code d'invitation", ar: 'أدخل رمز الدعوة' })}
                className="flex-1 px-3 py-2 text-[13px] rounded-xl border border-pw-border bg-pw-bg dark:bg-white/5 dark:text-white outline-none focus:border-pw-blue"
              />
              <button
                onClick={connectCode}
                disabled={codeLoading || !codeInput.trim()}
                className="px-4 py-2 bg-pw-blue text-white text-[12px] font-semibold rounded-xl disabled:opacity-50"
              >
                {codeLoading ? '...' : pick(lang, { nl: 'Verbind', en: 'Connect', pl: 'Połącz', tr: 'Bağlan', fr: 'Connecter', ar: 'ربط' })}
              </button>
            </div>
            {codeError && <p className="text-[11px] text-pw-red mt-1">{codeError}</p>}
            {codeSuccess && <p className="text-[11px] text-pw-green mt-1">✓ Verbonden met {codeSuccess}</p>}
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="border-t border-pw-border/40 px-4 py-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-2 rounded-xl bg-pw-blue/5 px-3 py-2.5">
          <CircleDot className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-pw-blue" strokeWidth={1.5} />
          <p className="text-[11px] leading-relaxed text-pw-muted">
            {pick(lang, {
              nl: 'Alleen je vangnet buddy of hulporganisatie kan een gesprek starten. Jij kunt hier antwoorden.',
              en: 'Only your safety net buddy or help organization can start a conversation. You can reply here.',
              pl: 'Tylko twój buddy z siatki bezpieczeństwa lub organizacja pomocowa może rozpocząć rozmowę. Możesz tu odpowiadać.',
              tr: 'Sadece güvenlik ağındaki destekçin veya yardım kuruluşu görüşme başlatabilir. Burada yanıt verebilirsin.', fr: "Seul ton soutien dans le filet de sécurité ou ton organisation d'aide peut démarrer un appel. Tu peux répondre ici.", ar: 'يمكن فقط لداعمك في شبكة الأمان أو منظمة المساعدة بدء مكالمة. يمكنك الرد هنا.',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
