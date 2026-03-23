'use client';

import { useState, useEffect } from 'react';
import { ShieldOff, Clock, AlertTriangle, Mail } from 'lucide-react';

interface BanOverlayProps {
  isBanned: boolean;
  bannedUntil: string | null;
  banReason: string | null;
}

export default function CommunityBanOverlay({ isBanned, bannedUntil, banReason }: BanOverlayProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);

  const isTimeout = !!bannedUntil;
  const banEnd = bannedUntil ? new Date(bannedUntil) : null;

  useEffect(() => {
    if (!banEnd) return;

    function updateCountdown() {
      const now = Date.now();
      const end = banEnd!.getTime();
      const diff = end - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remainHours = hours % 24;
        setTimeLeft(`${days}d ${remainHours}u ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}u ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [banEnd]);

  // If timeout expired, reload to clear ban
  useEffect(() => {
    if (expired) {
      window.location.reload();
    }
  }, [expired]);

  if (!isBanned) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.3)' }}>
      <div className="mx-4 w-full max-w-[380px] overflow-hidden rounded-card-lg bg-pw-surface" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>

        {/* Header stripe */}
        <div className={`px-6 py-5 ${isTimeout ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-red-500 to-red-600'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20">
              {isTimeout ? (
                <Clock className="h-5 w-5 text-white" strokeWidth={1.5} />
              ) : (
                <ShieldOff className="h-5 w-5 text-white" strokeWidth={1.5} />
              )}
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-white">
                {isTimeout ? 'Time-out' : 'Toegang geblokkeerd'}
              </h2>
              <p className="text-[12px] font-medium text-white/80">
                {isTimeout ? 'Je kunt tijdelijk niet posten' : 'Je community-toegang is geblokkeerd'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Countdown for timeout */}
          {isTimeout && timeLeft && (
            <div className="rounded-card bg-amber-50 border border-amber-200/50 p-4 text-center">
              <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wider mb-1">
                Resterende tijd
              </p>
              <p className="text-[28px] font-extrabold text-amber-700 tracking-tight leading-none font-mono">
                {timeLeft}
              </p>
              {banEnd && (
                <p className="mt-2 text-[11px] text-amber-600/70">
                  Tot {banEnd.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })} om {banEnd.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          {banReason && (
            <div className="rounded-card bg-pw-bg border border-pw-border p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-pw-muted flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <div>
                  <p className="text-[11px] font-semibold text-pw-muted uppercase tracking-wider mb-1">Reden</p>
                  <p className="text-[13px] text-pw-text leading-relaxed">{banReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* What you can do */}
          <div className="rounded-card bg-pw-bg border border-pw-border p-3.5">
            <p className="text-[11px] font-semibold text-pw-muted uppercase tracking-wider mb-2">
              Wat kun je doen?
            </p>
            <ul className="space-y-2">
              {isTimeout ? (
                <>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-blue mt-0.5">•</span>
                    Je kunt de feed nog steeds lezen
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-blue mt-0.5">•</span>
                    Na de time-out kun je weer posten en reageren
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-blue mt-0.5">•</span>
                    Houd je aan de communityregels om een nieuwe time-out te voorkomen
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-red mt-0.5">•</span>
                    Je kunt niet meer posten of reageren in de community
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-red mt-0.5">•</span>
                    Alle andere functies van PayWatch werken gewoon
                  </li>
                  <li className="flex items-start gap-2 text-[12px] text-pw-text leading-relaxed">
                    <span className="text-pw-blue mt-0.5">•</span>
                    Denk je dat dit onterecht is? Neem contact op
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Contact button for permanent bans */}
          {!isTimeout && (
            <a
              href="mailto:info@paywatch.app?subject=Community blokkade"
              className="btn-press flex w-full items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-2.5 text-[13px] font-semibold text-pw-text transition-colors hover:bg-pw-bg"
            >
              <Mail className="h-4 w-4" strokeWidth={1.5} />
              Contact opnemen
            </a>
          )}

          {/* Dismiss — still allows reading feed */}
          <button
            onClick={() => {
              const overlay = document.getElementById('ban-overlay');
              if (overlay) overlay.style.display = 'none';
            }}
            className="w-full text-center text-[12px] font-medium text-pw-muted hover:text-pw-text transition-colors"
          >
            {isTimeout ? 'Sluiten en feed lezen' : 'Sluiten'}
          </button>
        </div>
      </div>
    </div>
  );
}
