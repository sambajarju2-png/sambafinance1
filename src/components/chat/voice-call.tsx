'use client';

import { useState, useCallback, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

interface VoiceCallProps {
  onClose: () => void;
  lang: string;
}

export default function VoiceCall({ onClose, lang }: VoiceCallProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nl = lang === 'nl';

  const conversation = useConversation({
    onConnect: () => setIsConnecting(false),
    onDisconnect: () => onClose(),
    onError: (message: string) => {
      console.error('Voice error:', message);
      setError(nl ? 'Verbinding mislukt. Probeer opnieuw.' : 'Connection failed. Try again.');
      setIsConnecting(false);
    },
  });

  const startCall = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch('/api/voice/token');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Token failed');
      }

      const { signedUrl, overrides } = await res.json();

      await conversation.startSession({
        signedUrl,
        overrides,
      });
    } catch (err) {
      console.error('Start call error:', err);
      setError(
        (err as Error).message?.includes('Permission')
          ? (nl ? 'Microfoon nodig. Geef toegang in je browser.' : 'Microphone needed. Grant access in your browser.')
          : (nl ? 'Kan gesprek niet starten. Probeer opnieuw.' : "Can't start call. Try again.")
      );
      setIsConnecting(false);
    }
  }, [conversation, nl]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
    onClose();
  }, [conversation, onClose]);

  // Auto-start on mount
  useEffect(() => {
    startCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-pw-navy to-[#0F1B2D]">
      <div className="relative mb-10">
        {isActive && (
          <>
            <div className={`absolute rounded-full ${isSpeaking ? 'bg-pw-green/20' : 'bg-pw-blue/20'} animate-ping`} style={{ width: 160, height: 160, top: -40, left: -40 }} />
            <div className={`absolute rounded-full ${isSpeaking ? 'bg-pw-green/10' : 'bg-pw-blue/10'}`} style={{ width: 140, height: 140, top: -30, left: -30, animation: 'pulse 2s ease-in-out infinite' }} />
          </>
        )}

        <div className={`flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500 ${
          isConnecting ? 'bg-pw-blue/30' :
          isSpeaking ? 'bg-pw-green/40 scale-110' :
          isActive ? 'bg-pw-blue/40' :
          'bg-white/10'
        }`}>
          {isConnecting ? (
            <Loader2 className="h-8 w-8 animate-spin text-white/70" strokeWidth={1.5} />
          ) : (
            <Phone className="h-8 w-8 text-white" strokeWidth={1.5} />
          )}
        </div>
      </div>

      <p className="mb-2 text-lg font-semibold text-white">
        {isConnecting && (nl ? 'Verbinden...' : 'Connecting...')}
        {isActive && isSpeaking && 'PayBuddy'}
        {isActive && !isSpeaking && (nl ? 'Luistert...' : 'Listening...')}
        {!isConnecting && !isActive && 'PayBuddy'}
      </p>

      <p className="mb-12 text-sm text-white/50">
        {isConnecting && (nl ? 'Even geduld' : 'Please wait')}
        {isActive && isSpeaking && (nl ? 'Aan het praten' : 'Speaking')}
        {isActive && !isSpeaking && (nl ? 'Stel je vraag' : 'Ask your question')}
        {error && error}
      </p>

      <div className="flex items-center gap-6">
        {error && (
          <button
            onClick={startCall}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-pw-blue text-white transition-all active:scale-95"
          >
            <Phone className="h-6 w-6" strokeWidth={1.5} />
          </button>
        )}

        <button
          onClick={error ? onClose : endCall}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-pw-red text-white transition-all active:scale-95"
        >
          <PhoneOff className="h-7 w-7" strokeWidth={1.5} />
        </button>
      </div>

      <p className="absolute bottom-10 text-[11px] text-white/20">PayWatch Voice</p>
    </div>
  );
}
