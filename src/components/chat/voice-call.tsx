'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

interface VoiceCallProps {
  onClose: () => void;
  lang: string;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

function VoiceCallInner({ onClose, lang }: VoiceCallProps) {
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nl = lang === 'nl';

  const conversation = useConversation({
    onConnect: () => {
      setStatus('active');
      setDebugInfo('Connected!');
    },
    onDisconnect: async () => {
      if (transcriptRef.current.length > 0) {
        try {
          await fetch('/api/voice/save-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: transcriptRef.current }),
          });
        } catch {}
      }
      onClose();
    },
    onError: (message: string) => {
      console.error('ElevenLabs onError:', message);
      setErrorDetail(`SDK: ${message}`);
      setStatus('error');
    },
    onMessage: (msg: { source?: string; message?: string }) => {
      if (msg.message) {
        const entry: TranscriptEntry = {
          role: msg.source === 'user' ? 'user' : 'assistant',
          text: msg.message,
          ts: Date.now(),
        };
        transcriptRef.current.push(entry);
        setTranscript(prev => [...prev, entry]);
      }
    },
  });

  const startCall = useCallback(async () => {
    setStatus('connecting');
    setErrorDetail(null);
    setDebugInfo('Requesting microphone...');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setDebugInfo('Mic OK. Fetching token...');

      const res = await fetch('/api/voice/token');
      const data = await res.json();

      if (!res.ok) {
        setErrorDetail(`Token ${res.status}: ${JSON.stringify(data)}`);
        setStatus('error');
        return;
      }

      // signedUrl forces WebSocket (stable on iOS Safari PWA)
      // agentId + connectionType: 'websocket' as fallback
      if (data.signedUrl) {
        setDebugInfo('Connecting via WebSocket...');
        await conversation.startSession({
          signedUrl: data.signedUrl,
          overrides: data.overrides,
        });
      } else if (data.agentId) {
        setDebugInfo('Connecting via agentId (WS)...');
        await conversation.startSession({
          agentId: data.agentId,
          overrides: data.overrides,
          connectionType: 'websocket',
        });
      } else {
        setErrorDetail('No signedUrl or agentId returned');
        setStatus('error');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Voice startCall error:', err);
      setErrorDetail(msg);
      setStatus('error');
    }
  }, [conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  useEffect(() => {
    startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isActive = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-pw-navy to-[#0F1B2D]">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-6">
          {isActive && (
            <div
              className={`absolute rounded-full ${isSpeaking ? 'bg-pw-green/15' : 'bg-pw-blue/15'}`}
              style={{
                width: 140, height: 140, top: -30, left: -30,
                animation: isSpeaking ? 'pulse 1.5s ease-in-out infinite' : 'pulse 3s ease-in-out infinite',
              }}
            />
          )}
          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${
            status === 'connecting' ? 'bg-pw-blue/30' :
            isSpeaking ? 'bg-pw-green/40' :
            isActive ? 'bg-pw-blue/40' :
            'bg-white/10'
          }`}>
            {status === 'connecting' ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" strokeWidth={1.5} />
            ) : (
              <Phone className="h-8 w-8 text-white" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <p className="mb-1 text-lg font-semibold text-white">
          {status === 'connecting' && (nl ? 'Verbinden...' : 'Connecting...')}
          {isActive && isSpeaking && 'PayBuddy'}
          {isActive && !isSpeaking && (nl ? 'Luistert...' : 'Listening...')}
          {status === 'error' && 'PayBuddy'}
        </p>

        <p className="mb-2 text-[11px] text-white/30 text-center px-8">{debugInfo}</p>

        {errorDetail && (
          <div className="mx-6 mb-4 max-w-sm rounded-lg bg-pw-red/10 border border-pw-red/20 px-4 py-3">
            <p className="text-[11px] text-pw-red/80 font-mono break-all select-all">{errorDetail}</p>
            <button
              onClick={() => navigator.clipboard.writeText(errorDetail)}
              className="mt-2 text-[10px] text-pw-red/50 underline"
            >
              {nl ? 'Kopieer fout' : 'Copy error'}
            </button>
          </div>
        )}
      </div>

      {transcript.length > 0 && (
        <div className="mx-4 mb-4 max-h-[30vh] overflow-y-auto rounded-2xl bg-white/5 px-4 py-3">
          {transcript.map((t, i) => (
            <div key={i} className={`mb-1.5 text-[12px] leading-relaxed ${
              t.role === 'user' ? 'text-pw-blue/70' : 'text-white/60'
            }`}>
              <span className="font-medium">{t.role === 'user' ? (nl ? 'Jij' : 'You') : 'PayBuddy'}:</span>{' '}
              {t.text}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      <div className="flex items-center justify-center gap-6 pb-12" style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}>
        {status === 'error' && (
          <button onClick={startCall} className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue text-white active:scale-95">
            <Phone className="h-6 w-6" strokeWidth={1.5} />
          </button>
        )}
        <button
          onClick={status === 'error' ? onClose : endCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-pw-red text-white active:scale-95"
        >
          <PhoneOff className="h-7 w-7" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export default function VoiceCall(props: VoiceCallProps) {
  return (
    <ConversationProvider>
      <VoiceCallInner {...props} />
    </ConversationProvider>
  );
}
