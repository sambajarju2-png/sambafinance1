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
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const nl = lang === 'nl';

  const conversation = useConversation({
    onConnect: () => setStatus('active'),
    onDisconnect: async () => {
      // Save transcript on disconnect
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
      console.error('Voice error:', message);
      setError(nl ? 'Verbinding mislukt.' : 'Connection failed.');
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
    setError(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch('/api/voice/token');
      if (!res.ok) throw new Error('Token failed');

      const { conversationToken, signedUrl, overrides } = await res.json();

      // Use conversationToken for WebRTC (better), signedUrl for WebSocket (fallback)
      const sessionOpts: Record<string, unknown> = {
        overrides,
        serverLocation: 'eu-residency',
      };

      if (conversationToken) {
        sessionOpts.conversationToken = conversationToken;
      } else if (signedUrl) {
        sessionOpts.signedUrl = signedUrl;
      }

      await conversation.startSession(sessionOpts);
    } catch (err) {
      const msg = (err as Error).message || '';
      setError(
        msg.includes('Permission') || msg.includes('NotAllowed')
          ? (nl ? 'Microfoon nodig. Geef toegang.' : 'Microphone needed.')
          : (nl ? 'Kan niet verbinden.' : "Can't connect.")
      );
      setStatus('error');
    }
  }, [conversation, nl]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  // Auto-start
  useEffect(() => {
    startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isActive = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-pw-navy to-[#0F1B2D]">
      {/* Top area with circle */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Pulsing circle */}
        <div className="relative mb-6">
          {isActive && (
            <div
              className={`absolute rounded-full ${isSpeaking ? 'bg-pw-green/15' : 'bg-pw-blue/15'}`}
              style={{
                width: 140, height: 140, top: -30, left: -30,
                animation: isSpeaking ? 'pulse 1.5s ease-in-out infinite' : 'pulse 3s ease-in-out infinite',
                transition: 'background-color 0s',
              }}
            />
          )}

          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${
            status === 'connecting' ? 'bg-pw-blue/30' :
            isSpeaking ? 'bg-pw-green/40' :
            isActive ? 'bg-pw-blue/40' :
            'bg-white/10'
          }`} style={{ transition: 'background-color 0s' }}>
            {status === 'connecting' ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/70" strokeWidth={1.5} />
            ) : (
              <Phone className="h-8 w-8 text-white" strokeWidth={1.5} />
            )}
          </div>
        </div>

        {/* Status */}
        <p className="mb-1 text-lg font-semibold text-white">
          {status === 'connecting' && (nl ? 'Verbinden...' : 'Connecting...')}
          {isActive && isSpeaking && 'PayBuddy'}
          {isActive && !isSpeaking && (nl ? 'Luistert...' : 'Listening...')}
          {status === 'error' && 'PayBuddy'}
        </p>

        <p className="mb-6 text-sm text-white/40">
          {status === 'connecting' && (nl ? 'Even geduld' : 'Please wait')}
          {isActive && isSpeaking && (nl ? 'Aan het praten' : 'Speaking')}
          {isActive && !isSpeaking && (nl ? 'Stel je vraag' : 'Ask your question')}
          {error && error}
        </p>
      </div>

      {/* Live transcript */}
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

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-6 pb-12" style={{ paddingBottom: 'max(48px, env(safe-area-inset-bottom))' }}>
        {status === 'error' && (
          <button
            onClick={startCall}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue text-white active:scale-95"
          >
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

// Wrap with ConversationProvider (required by @elevenlabs/react v1.1.1)
export default function VoiceCall(props: VoiceCallProps) {
  return (
    <ConversationProvider>
      <VoiceCallInner {...props} />
    </ConversationProvider>
  );
}
