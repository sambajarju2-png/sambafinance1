'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface PaidToastProps {
  vendor: string;
  amount: number;
  currency?: string;
  onDone: () => void;
}

export default function PaidToast({ vendor, amount, currency = 'EUR', onDone }: PaidToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setExiting(true), 2500);
    const doneTimer = setTimeout(onDone, 2800);
    return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div className={`fixed left-4 right-4 top-16 z-[200] ${exiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="mx-auto max-w-sm rounded-card border border-pw-green/20 bg-pw-surface px-4 py-3 shadow-[var(--shadow-toast)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pw-green/10">
            <Check className="h-4 w-4 text-pw-green" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-semibold text-pw-text">
              {vendor} — {formatCents(amount, currency)} betaald!
            </p>
          </div>
          <span className="text-[16px]">🎉</span>
        </div>
      </div>
    </div>
  );
}
