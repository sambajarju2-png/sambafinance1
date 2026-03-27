'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, QrCode, Flashlight } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const jsQRRef = useRef<any>(null);

  // Load jsQR dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = () => {
      jsQRRef.current = (window as any).jsQR;
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const stopCamera = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLoading(false);
    } catch {
      setError('Camera niet beschikbaar. Geef toestemming in je instellingen.');
      setLoading(false);
    }
  }, []);

  // Start scanning frames
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Frame scanning loop
  useEffect(() => {
    if (loading || error) return;

    let found = false;

    function scanFrame() {
      if (found) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const jsQR = jsQRRef.current;

      if (!video || !canvas || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { animationRef.current = requestAnimationFrame(scanFrame); return; }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        found = true;
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(100);
        stopCamera();
        onScan(code.data);
        return;
      }

      animationRef.current = requestAnimationFrame(scanFrame);
    }

    // Small delay to let jsQR load
    const timer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(scanFrame);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [loading, error, onScan, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Close button */}
      <button onClick={() => { stopCamera(); onClose(); }}
        className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
        <X className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Camera feed */}
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Darkened edges */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Clear center square */}
        <div className="relative z-10" style={{ width: 260, height: 260 }}>
          {/* Cut-out effect */}
          <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,0.5)' }} />

          {/* Corner brackets */}
          <div className="absolute top-0 left-0 h-8 w-8 rounded-tl-2xl border-t-[3px] border-l-[3px] border-white" />
          <div className="absolute top-0 right-0 h-8 w-8 rounded-tr-2xl border-t-[3px] border-r-[3px] border-white" />
          <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
          <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />

          {/* Scanning line animation */}
          <div className="absolute left-4 right-4 h-[2px] bg-pw-blue/80 animate-scan-line" />
        </div>

        {/* Instructions */}
        <div className="relative z-10 mt-8 text-center">
          <p className="text-[14px] font-semibold text-white">Richt op de QR-code</p>
          <p className="mt-1 text-[12px] text-white/60">Op je factuur of acceptgiro</p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-white" strokeWidth={1.5} />
          <p className="text-[14px] text-white/70">Camera starten...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black px-8">
          <QrCode className="mb-4 h-12 w-12 text-white/50" strokeWidth={1.5} />
          <p className="text-[14px] text-white/70 text-center">{error}</p>
          <button onClick={() => { stopCamera(); onClose(); }}
            className="mt-6 rounded-button bg-white/10 px-6 py-3 text-[13px] font-semibold text-white backdrop-blur">
            Terug
          </button>
        </div>
      )}

      {/* Scan line animation style */}
      <style>{`
        @keyframes scan-line {
          0% { top: 10%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
          position: absolute;
        }
      `}</style>
    </div>
  );
}
