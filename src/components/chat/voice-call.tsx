'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, Loader2, Check, ArrowRight, X, Camera } from 'lucide-react';
import { sounds } from '@/lib/sounds';
import { getCachedVoiceToken, clearVoiceTokenCache } from '@/lib/voice-token-cache';
import { useStatusBar } from '@/lib/use-status-bar';

interface VoiceCallProps {
  onClose: (showSummary?: PostCallData | null) => void;
  lang: string;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

interface CallAction {
  type: 'bill_added' | 'bill_updated' | 'bill_removed' | 'sent_to_chat';
  data: Record<string, unknown>;
  ts: number;
}

export interface PostCallData {
  duration: number;
  billsAdded: Array<{ vendor: string; amount: number }>;
  sentToChat: number;
  transcriptCount: number;
}

/* ── Strip emotion tags like [happy], [excited] etc. from agent speech ── */
function cleanAgentText(text: string): string {
  return text
    .replace(/\[(?:happy|excited|sad|surprised|angry|neutral|thinking|laughing|confused|concerned|empathetic)\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ─────────────────────────────────────────────
   VOICE ORB — Canvas-based reactive animation
   ───────────────────────────────────────────── */
function VoiceOrb({ status, isSpeaking }: { status: string; isSpeaking: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const size = 200;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const center = size / 2;

    function draw() {
      phaseRef.current += 0.02;
      const t = phaseRef.current;
      ctx.clearRect(0, 0, size, size);

      const isActive = status === 'active';
      const baseR = isActive ? (isSpeaking ? 34 : 36) : 32;

      const green = { r: 5, g: 150, b: 105 };
      const blue = { r: 37, g: 99, b: 235 };
      const red = { r: 220, g: 38, b: 38 };
      let color = status === 'error' ? red : (isActive && isSpeaking ? green : blue);

      // Outer organic rings
      for (let ring = 3; ring >= 1; ring--) {
        const breathe = isSpeaking
          ? Math.sin(t * (2.5 + ring * 0.7)) * (6 + ring * 4)
          : Math.sin(t * (0.8 + ring * 0.2)) * (2 + ring * 2);
        const ringR = baseR + ring * 12 + breathe;
        const alpha = isSpeaking ? 0.08 + Math.sin(t * 2 + ring) * 0.04 : 0.04 + Math.sin(t * 0.5 + ring) * 0.02;

        ctx.beginPath();
        for (let angle = 0; angle <= Math.PI * 2; angle += 0.05) {
          const wobble = isSpeaking
            ? Math.sin(angle * 3 + t * 2) * 3 + Math.sin(angle * 5 - t * 1.5) * 2
            : Math.sin(angle * 2 + t * 0.8) * 1.5;
          const r = ringR + wobble;
          const x = center + Math.cos(angle) * r;
          const y = center + Math.sin(angle) * r;
          if (angle === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        ctx.fill();
      }

      // Inner glow
      const glowR = baseR + (isSpeaking ? Math.sin(t * 3) * 4 : Math.sin(t) * 2);
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, glowR + 10);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
      gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, 0.15)`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.beginPath();
      ctx.arc(center, center, glowR + 10, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      const coreGrad = ctx.createRadialGradient(center - 8, center - 8, 0, center, center, baseR);
      coreGrad.addColorStop(0, `rgba(${Math.min(255, color.r + 60)}, ${Math.min(255, color.g + 60)}, ${Math.min(255, color.b + 60)}, 0.6)`);
      coreGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.35)`);
      ctx.beginPath();
      ctx.arc(center, center, baseR, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Speaking particles
      if (isSpeaking && isActive) {
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * 2 / 8) * i + t * 0.5;
          const dist = baseR + 20 + Math.sin(t * 3 + i * 1.5) * 15;
          const px = center + Math.cos(a) * dist;
          const py = center + Math.sin(a) * dist;
          const pSize = 1.5 + Math.sin(t * 2 + i) * 1;
          const pAlpha = 0.3 + Math.sin(t * 2.5 + i) * 0.2;
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${pAlpha})`;
          ctx.fill();
        }
      }

      // Connecting spinner
      if (status === 'connecting') {
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + (Math.PI * 2 / 3) * i;
          const x = center + Math.cos(a) * (baseR + 15);
          const y = center + Math.sin(a) * (baseR + 15);
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.2 + Math.sin(t * 4 + i * 2) * 0.15})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [status, isSpeaking]);

  return <canvas ref={canvasRef} style={{ width: 200, height: 200 }} className="pointer-events-none" />;
}

/* ─────────────────────────────────────────────
   POST-CALL SUMMARY
   ───────────────────────────────────────────── */
export function PostCallSummary({ data, lang, onDismiss, onViewBills }: {
  data: PostCallData;
  lang: string;
  onDismiss: () => void;
  onViewBills: () => void;
}) {
  const nl = lang === 'nl';
  const mins = Math.floor(data.duration / 60);
  const secs = data.duration % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onDismiss}>
      <div
        className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-pw-navy px-5 pb-8 pt-6 animate-[slideUp_0.3s_ease-out]"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-green/10">
              <Phone className="h-5 w-5 text-pw-green" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {nl ? 'Gesprek afgerond' : 'Call ended'}
              </p>
              <p className="text-[12px] text-gray-500">{mins}:{String(secs).padStart(2, '0')} min</p>
            </div>
          </div>
          <button onClick={onDismiss} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-white/5">
            <X className="h-5 w-5 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-3 text-center">
            <p className="text-[20px] font-bold text-pw-green">{data.billsAdded.length}</p>
            <p className="text-[11px] text-gray-500">{nl ? 'Toegevoegd' : 'Added'}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-3 text-center">
            <p className="text-[20px] font-bold text-pw-blue">{data.sentToChat}</p>
            <p className="text-[11px] text-gray-500">{nl ? 'In chat' : 'To chat'}</p>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-3 text-center">
            <p className="text-[20px] font-bold text-gray-600 dark:text-gray-300">{data.transcriptCount}</p>
            <p className="text-[11px] text-gray-500">{nl ? 'Berichten' : 'Messages'}</p>
          </div>
        </div>

        {/* Bills added */}
        {data.billsAdded.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[12px] font-medium text-gray-500 uppercase tracking-wide">
              {nl ? 'Rekeningen toegevoegd' : 'Bills added'}
            </p>
            {data.billsAdded.map((bill, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-pw-green" strokeWidth={2} />
                  <span className="text-[14px] text-gray-900 dark:text-white">{bill.vendor}</span>
                </div>
                <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300">
                  €{(bill.amount / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2.5">
          {data.billsAdded.length > 0 && (
            <button
              onClick={onViewBills}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pw-blue py-3.5 text-[14px] font-medium text-white active:scale-[0.98]"
            >
              {nl ? 'Bekijk rekeningen' : 'View bills'}
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={onDismiss}
            className="w-full rounded-xl bg-gray-100 dark:bg-white/5 py-3.5 text-[14px] font-medium text-gray-700 dark:text-gray-300 active:scale-[0.98]"
          >
            {nl ? 'Sluiten' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN VOICE CALL INNER
   ───────────────────────────────────────────── */
function VoiceCallInner({ onClose, lang }: VoiceCallProps) {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [billsAdded, setBillsAdded] = useState<Array<{ vendor: string; amount: number }>>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState<string | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const callActionsRef = useRef<CallAction[]>([]);
  const callStartRef = useRef<number>(Date.now());
  const sentToChatRef = useRef(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const nl = lang === 'nl';

  // Voice call has dark background — light status bar text
  useStatusBar('light');

  const conversation = useConversation({
    onConnect: () => {
      setStatus('active');
      setDebugInfo('');
      callStartRef.current = Date.now();
      sounds.connecting();
    },
    onDisconnect: async () => {
      sounds.callEnded();
      clearVoiceTokenCache(); // Force fresh token for next call
      // Save transcript
      if (transcriptRef.current.length > 0) {
        try {
          await fetch('/api/voice/save-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: transcriptRef.current }),
          });
        } catch {}
      }

      // Build post-call data
      const duration = Math.floor((Date.now() - callStartRef.current) / 1000);

      // Log voice usage (fire-and-forget — don't block UI)
      if (duration >= 5) {
        fetch('/api/voice/log-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seconds: duration }),
        }).catch(() => {});
      }
      const postCallData: PostCallData = {
        duration,
        billsAdded: callActionsRef.current
          .filter(a => a.type === 'bill_added')
          .map(a => ({ vendor: a.data.vendor as string, amount: a.data.amount as number })),
        sentToChat: sentToChatRef.current,
        transcriptCount: transcriptRef.current.length,
      };

      // Show summary if anything happened, otherwise just close
      if (postCallData.billsAdded.length > 0 || postCallData.sentToChat > 0 || duration > 10) {
        onClose(postCallData);
      } else {
        onClose(null);
      }
    },
    onError: (message: string) => {
      console.error('ElevenLabs onError:', message);
      setErrorDetail(`SDK: ${message}`);
      setStatus('error');
    },
    onMessage: (msg: { source?: string; message?: string }) => {
      if (msg.message) {
        // Clean emotion tags from agent responses
        const cleaned = msg.source === 'user' ? msg.message : cleanAgentText(msg.message);
        if (!cleaned) return; // Skip empty messages after cleaning

        const entry: TranscriptEntry = {
          role: msg.source === 'user' ? 'user' : 'assistant',
          text: cleaned,
          ts: Date.now(),
        };
        transcriptRef.current.push(entry);
        setTranscript(prev => [...prev, entry]);
      }
    },
    clientTools: {
      // ── Add bill ──
      add_bill: async (params: { vendor: string; amount: string; due_date?: string; escalation_stage?: string; iban?: string }) => {
        try {
          const amountNum = parseFloat(String(params.amount).replace(',', '.'));
          const amountCents = Math.round(amountNum * 100);
          if (!params.vendor || !amountCents) return 'Fout: vendor en bedrag zijn verplicht.';

          const res = await fetch('/api/chat/confirm-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vendor: params.vendor,
              amount_cents: amountCents,
              due_date: params.due_date || null,
              escalation_stage: params.escalation_stage || 'factuur',
              iban: params.iban || null,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            sounds.billAdded();
            callActionsRef.current.push({ type: 'bill_added', data: { vendor: params.vendor, amount: amountCents }, ts: Date.now() });
            setBillsAdded(prev => [...prev, { vendor: params.vendor, amount: amountCents }]);
            if (data.duplicate) return `${params.vendor} stond al in de app.`;
            return `${params.vendor} is opgeslagen.`;
          }
          return 'Kon niet toevoegen, probeer opnieuw.';
        } catch {
          return 'Er ging iets mis bij het opslaan.';
        }
      },

      // ── Update bill (escalation, amount, status) ──
      update_bill: async (params: { vendor: string; escalation_stage?: string; amount?: string; status?: string }) => {
        try {
          const res = await fetch('/api/voice/update-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          if (res.ok) {
            sounds.sentToChat();
            callActionsRef.current.push({ type: 'bill_updated', data: { vendor: params.vendor, change: params.escalation_stage || params.status || '' }, ts: Date.now() });
            return `${params.vendor} is bijgewerkt.`;
          }
          return 'Kon niet bijwerken.';
        } catch {
          return 'Er ging iets mis.';
        }
      },

      // ── Remove / mark as paid ──
      remove_bill: async (params: { vendor: string; mark_as_paid?: boolean }) => {
        try {
          const res = await fetch('/api/voice/remove-bill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
          });
          if (res.ok) {
            sounds.billAdded();
            callActionsRef.current.push({ type: 'bill_removed', data: { vendor: params.vendor }, ts: Date.now() });
            return params.mark_as_paid
              ? `${params.vendor} als betaald gemarkeerd.`
              : `${params.vendor} verwijderd.`;
          }
          return 'Kon niet verwijderen.';
        } catch {
          return 'Er ging iets mis.';
        }
      },

      // ── Get bill summary ──
      get_bill_summary: async () => {
        try {
          const res = await fetch('/api/voice/bill-summary');
          if (res.ok) {
            const data = await res.json();
            return JSON.stringify(data);
          }
          return 'Kon samenvatting niet ophalen.';
        } catch {
          return 'Er ging iets mis.';
        }
      },

      // ── Request photo — opens camera, returns instantly. Scan result injected via sendUserMessage ──
      request_photo: () => {
        setShowCamera(true);
        return nl
          ? 'Camera geopend. Maak een foto van je rekening.'
          : 'Camera opened. Take a photo of your bill.';
      },

      // ── Get schuldhulp info for user's gemeente ──
      get_schuldhulp: async (params: { gemeente?: string }) => {
        try {
          const url = params.gemeente
            ? `/api/voice/schuldhulp?gemeente=${encodeURIComponent(params.gemeente)}`
            : '/api/voice/schuldhulp';
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            // Track that info was saved to chat (route auto-saves when found)
            if (data.found) {
              sounds.sentToChat();
              sentToChatRef.current += 1;
              callActionsRef.current.push({ type: 'sent_to_chat', data: { message: `Schuldhulp: ${data.gemeente}` }, ts: Date.now() });
            }
            return data.summary || JSON.stringify(data);
          }
          return 'Kon schuldhulp informatie niet ophalen.';
        } catch {
          return 'Er ging iets mis. Bel de Nationale Schuldhulproute: 0800-8115.';
        }
      },

      // ── Send to chat (voice-to-chat handoff) ──
      send_to_chat: async (params: { message: string; type?: string }) => {
        try {
          await fetch('/api/voice/send-to-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: params.message, type: params.type || 'note' }),
          });
          sounds.sentToChat();
          sentToChatRef.current += 1;
          callActionsRef.current.push({ type: 'sent_to_chat', data: { message: params.message }, ts: Date.now() });
          return 'In de chat gezet.';
        } catch {
          return 'Kon niet naar de chat sturen.';
        }
      },

      // ── WIK Shield: check incasso overcharge ──
      check_wik: async (params: { bill_amount: string; claimed_costs: string; vendor?: string }) => {
        try {
          const res = await fetch('/api/voice/wik-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bill_amount: params.bill_amount,
              claimed_costs: params.claimed_costs,
              vendor: params.vendor || '',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.overcharged) sounds.sentToChat();
            return data.summary || JSON.stringify(data);
          }
          return 'Kon WIK-check niet uitvoeren.';
        } catch {
          return 'Er ging iets mis bij de WIK-controle.';
        }
      },

      // ── WIK Shield: draft bezwaar letter ──
      draft_wik_bezwaar: async (params: { vendor: string; bill_amount: string; claimed_costs: string }) => {
        try {
          const res = await fetch('/api/voice/wik-bezwaar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vendor: params.vendor,
              bill_amount: params.bill_amount,
              claimed_costs: params.claimed_costs,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            sounds.sentToChat();
            sentToChatRef.current += 1;
            callActionsRef.current.push({ type: 'sent_to_chat', data: { message: `WIK bezwaarbrief: ${params.vendor}` }, ts: Date.now() });
            return data.summary || 'Bezwaarbrief staat in de chat.';
          }
          return 'Kon de bezwaarbrief niet maken.';
        } catch {
          return 'Er ging iets mis bij het opstellen van de brief.';
        }
      },

      // ── Get full financial overview (income, expenses, toeslagen, beslagvrije voet, bills) ──
      get_financial_overview: async () => {
        try {
          const res = await fetch('/api/voice/financial-overview');
          if (res.ok) {
            const data = await res.json();
            return data.summary || JSON.stringify(data);
          }
          return 'Kon financieel overzicht niet ophalen.';
        } catch {
          return 'Er ging iets mis bij het ophalen van financiele gegevens.';
        }
      },
    },
  });

  const startCall = useCallback(async () => {
    setStatus('connecting');
    setErrorDetail(null);
    setDebugInfo('');

    try {
      // Pre-check: verify mic permission is not denied (non-blocking, doesn't acquire hardware).
      // The SDK will call getUserMedia internally — do NOT acquire & release the stream here
      // because the rapid acquire/release/acquire cycle breaks audio on iOS WKWebView and
      // some Android browsers (the SDK gets a silent or blocked track).
      if (navigator.permissions) {
        try {
          const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (perm.state === 'denied') {
            setErrorDetail('Microfoon geblokkeerd. Ga naar instellingen om toegang te geven.');
            setStatus('error');
            return;
          }
        } catch {
          // permissions.query('microphone') not supported on all browsers — that's OK
        }
      }

      // Use pre-warmed token if available (avoids 600ms–1.5s ElevenLabs API call)
      const cached = getCachedVoiceToken();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any;
      if (cached) {
        data = cached;
      } else {
        const res = await fetch('/api/voice/token');
        data = await res.json();
        if (!res.ok) {
          if (data.error === 'voice_limit_reached') {
            setLimitReached(data.message as string || 'Je beltegoed is op voor deze maand.');
            setStatus('error');
            return;
          }
          setErrorDetail(`Token ${res.status}: ${JSON.stringify(data)}`);
          setStatus('error');
          return;
        }
      }



      // Store remaining time so UI can show it
      if (typeof data.remainingSeconds === 'number') {
        setRemainingSeconds(data.remainingSeconds);
      }

      // Try connection methods in order: conversationToken (WebRTC) → signedUrl (WebSocket) → agentId
      let connected = false;

      if (data.conversationToken) {
        try {
          await conversation.startSession({ conversationToken: data.conversationToken, overrides: data.overrides });
          connected = true;
        } catch (e) {
          console.warn('[VoiceCall] conversationToken failed, falling back to signedUrl:', e);
        }
      }

      if (!connected && data.signedUrl) {
        try {
          await conversation.startSession({ signedUrl: data.signedUrl, overrides: data.overrides });
          connected = true;
        } catch (e) {
          console.warn('[VoiceCall] signedUrl failed, falling back to agentId:', e);
        }
      }

      if (!connected && data.agentId) {
        await conversation.startSession({ agentId: data.agentId, overrides: data.overrides, connectionType: 'websocket' });
        connected = true;
      }

      if (!connected) {
        setErrorDetail('No connection method available');
        setStatus('error');
      }
    } catch (err) {
      setErrorDetail(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Stable ref to conversation so cleanup can always access the latest instance
  const conversationRef = useRef(conversation);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);

  // Start call on mount; clean up on unmount (releases microphone indicator in iOS status bar)
  useEffect(() => {
    startCall();
    return () => {
      // End session when component unmounts (user navigates away without hanging up)
      try { conversationRef.current.endSession(); } catch { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  const isActive = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-pw-navy to-[#0F1B2D]">
      {/* Top: Orb + status */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <VoiceOrb
          status={status === 'active' ? 'active' : status === 'connecting' ? 'connecting' : 'error'}
          isSpeaking={isSpeaking}
        />

        <p className="mt-2 text-lg font-semibold text-white">
          {status === 'connecting' && (nl ? 'Verbinden...' : 'Connecting...')}
          {isActive && isSpeaking && 'PayBuddy'}
          {isActive && !isSpeaking && (nl ? 'Luistert...' : 'Listening...')}
          {status === 'error' && 'PayBuddy'}
        </p>

        <p className="mt-0.5 text-[13px] text-white/40">
          {isActive && isSpeaking && (nl ? 'Aan het praten' : 'Speaking')}
          {isActive && !isSpeaking && (nl ? 'Stel je vraag' : 'Ask your question')}
          {status === 'error' && (nl ? 'Verbinding mislukt' : 'Connection failed')}
        </p>

        {debugInfo && <p className="mt-1 text-[11px] text-white/20">{debugInfo}</p>}

        {/* Remaining voice time indicator */}
        {status === 'active' && remainingSeconds !== null && remainingSeconds < 300 && (
          <div className="mt-3 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30">
            <p className="text-[11px] text-amber-300 font-medium">
              {Math.floor(remainingSeconds / 60)} min {remainingSeconds % 60}s beltijd resterend
            </p>
          </div>
        )}

        {/* Plan limit reached */}
        {limitReached && (
          <div className="mx-6 mt-4 max-w-sm rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4 text-center">
            <p className="text-[13px] text-amber-300 font-semibold mb-1">Beltegoed op</p>
            <p className="text-[11px] text-white/50 leading-relaxed">{limitReached}</p>
          </div>
        )}

        {/* Bills added badges */}
        {billsAdded.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 px-6">
            {billsAdded.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5 rounded-full bg-pw-green/15 px-3 py-1.5 text-[12px] font-medium text-pw-green">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                {b.vendor}
              </span>
            ))}
          </div>
        )}

        {errorDetail && (
          <div className="mx-6 mt-4 max-w-sm rounded-2xl bg-pw-red/8 border border-pw-red/15 px-4 py-3">
            <p className="text-[11px] text-pw-red/70 font-mono break-all select-all">{errorDetail}</p>
            <button onClick={() => navigator.clipboard.writeText(errorDetail)} className="mt-2 text-[10px] text-pw-red/40 underline">
              {nl ? 'Kopieer fout' : 'Copy error'}
            </button>
          </div>
        )}
      </div>

      {/* Live transcript */}
      {transcript.length > 0 && (
        <div className="mx-4 mb-4 max-h-[28vh] overflow-y-auto rounded-2xl bg-white/[0.03] backdrop-blur-sm px-4 py-3 border border-white/[0.04]">
          {transcript.map((t, i) => (
            <div key={i} className={`mb-2 text-[12px] leading-relaxed ${
              t.role === 'user' ? 'text-pw-blue/60' : 'text-white/50'
            }`}>
              <span className="font-semibold text-[11px] uppercase tracking-wider opacity-60">
                {t.role === 'user' ? (nl ? 'Jij' : 'You') : 'PayBuddy'}
              </span>
              <br />
              {t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* Camera input for bill photos */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setShowCamera(false);
          setProcessingPhoto(true);

          try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/voice/scan-image', {
              method: 'POST',
              body: formData,
            });

            const data = await res.json();
            const spoken: string = data.spoken || (nl ? 'Ik heb de foto bekeken maar kon geen details vinden.' : 'I looked at the photo but could not find details.');
            const docType: string = data.document_type || 'onbekend';
            const isBill: boolean = data.is_bill || false;

            // Build context-rich message for the agent
            // Include document type so agent knows whether to offer add_bill or just explain
            let prefix = '[SCAN_RESULT]';
            if (isBill) prefix += ' [TYPE:REKENING]';
            else prefix += ` [TYPE:${docType.toUpperCase()}]`;

            conversation.sendUserMessage(`${prefix} ${spoken}`);

            sentToChatRef.current += 1;
            sounds.sentToChat();
          } catch {
            conversation.sendUserMessage(
              nl ? '[SCAN_ERROR] Kon de foto niet analyseren. Probeer opnieuw met betere belichting.' : '[SCAN_ERROR] Could not scan the photo. Try again with better lighting.'
            );
          } finally {
            setProcessingPhoto(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
          }
        }}
      />

      {/* Photo processing indicator */}
      {processingPhoto && (
        <div className="absolute inset-x-0 bottom-28 flex justify-center z-10 px-6">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 px-5 py-3">
            <div className="w-4 h-4 border-2 border-pw-blue border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <p className="text-[13px] text-white/80">
              {nl ? 'Foto analyseren...' : 'Analysing photo...'}
            </p>
          </div>
        </div>
      )}

      {/* Camera prompt overlay */}
      {showCamera && (
        <div className="absolute inset-x-0 bottom-28 flex justify-center z-10 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 text-center">
            <p className="text-[13px] text-white/80 mb-3">
              {nl ? 'Maak een foto van je rekening' : 'Take a photo of your bill'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (photoInputRef.current) {
                    photoInputRef.current.setAttribute('capture', 'environment');
                    photoInputRef.current.click();
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pw-blue py-2.5 text-[13px] font-medium text-white active:scale-95"
              >
                <Camera className="h-4 w-4" strokeWidth={1.5} />
                {nl ? 'Camera' : 'Camera'}
              </button>
              <button
                onClick={() => {
                  if (photoInputRef.current) {
                    photoInputRef.current.removeAttribute('capture');
                    photoInputRef.current.click();
                  }
                }}
                className="flex-1 rounded-xl bg-white/10 py-2.5 text-[13px] font-medium text-white/80 active:scale-95"
              >
                {nl ? 'Galerij' : 'Gallery'}
              </button>
            </div>
            <button
              onClick={() => setShowCamera(false)}
              className="mt-2 text-[11px] text-white/40"
            >
              {nl ? 'Annuleren' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="flex items-center justify-center gap-5 pb-10" style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}>
        {/* Camera button (during active call) */}
        {isActive && (
          <button
            onClick={() => setShowCamera(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/70 active:scale-95"
          >
            <Camera className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}

        {status === 'error' && (
          <button onClick={startCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue text-white active:scale-95 shadow-lg shadow-pw-blue/20">
            <Phone className="h-6 w-6" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={status === 'error' ? () => onClose(null) : endCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-pw-red text-white active:scale-95 shadow-lg shadow-pw-red/20"
        >
          <PhoneOff className="h-7 w-7" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   WRAPPER
   ───────────────────────────────────────────── */
export default function VoiceCall(props: VoiceCallProps) {
  return (
    <ConversationProvider>
      <VoiceCallInner {...props} />
    </ConversationProvider>
  );
}
