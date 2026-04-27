'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('pw-splash-shown')) {
      setVisible(false);
      return;
    }

    // Detect native app via user agent — this is synchronous and reliable
    // Capacitor WKWebView always contains these strings
    const ua = navigator.userAgent || '';
    const isNative = /Capacitor|PayWatch/i.test(ua) || 
      (typeof navigator !== 'undefined' && (navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches;
    
    if (isNative) {
      setVisible(false);
      sessionStorage.setItem('pw-splash-shown', '1');
      return;
    }

    const fadeTimer = setTimeout(() => setFadeOut(true), 1800);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('pw-splash-shown', '1');
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-400 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#0A2540' }}
    >
      <div className="splash-logo mb-4">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      </div>
      <h1 className="splash-wordmark text-[28px] font-bold tracking-tight text-white">PayWatch</h1>
      <p className="splash-tagline mt-2 text-center text-[14px] font-normal text-white/60">
        Nooit meer verrast door een incassobureau
      </p>
      <div className="mt-8 flex items-center gap-1.5">
        <div className="splash-dot h-2 w-2 rounded-full bg-white/40" style={{ animationDelay: '0ms' }} />
        <div className="splash-dot h-2 w-2 rounded-full bg-white/40" style={{ animationDelay: '200ms' }} />
        <div className="splash-dot h-2 w-2 rounded-full bg-white/40" style={{ animationDelay: '400ms' }} />
      </div>
      <style jsx>{`
        .splash-logo { animation: splashBounceIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .splash-wordmark { animation: splashFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both; }
        .splash-tagline { animation: splashFadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both; }
        .splash-dot { animation: splashPulse 1.2s ease-in-out infinite; }
        @keyframes splashBounceIn { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes splashFadeUp { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes splashPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
