'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, X, Building2, ArrowRight, CreditCard, Loader2 } from 'lucide-react';

interface Match {
  transaction_id: string;
  bill_id: string;
  bank_name: string;
  creditor_name: string;
  creditor_iban: string;
  tx_amount: number;
  tx_date: string;
  tx_description: string;
  bill_vendor: string;
  bill_amount: number;
  bill_due_date: string;
}

export default function MatchCards() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState<'left' | 'right' | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/matches');
      const data = await res.json();
      setMatches(data.matches || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  async function handleAction(action: 'confirm' | 'dismiss') {
    const match = matches[currentIndex];
    if (!match || acting) return;

    setActing(true);
    setSwiping(action === 'confirm' ? 'right' : 'left');

    try {
      await fetch('/api/bank/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: match.transaction_id,
          bill_id: match.bill_id,
          action
        })
      });
    } catch { /* silent */ }

    // Wait for animation
    setTimeout(() => {
      setSwiping(null);
      setCurrentIndex(i => i + 1);
      setActing(false);
    }, 300);
  }

  if (loading) return null;
  if (matches.length === 0 || currentIndex >= matches.length) return null;

  const match = matches[currentIndex];
  const remaining = matches.length - currentIndex;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pw-blue/10">
          <CreditCard className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold text-pw-navy">
            {remaining} betaling{remaining !== 1 ? 'en' : ''} gevonden
          </h3>
          <p className="text-[11px] text-pw-muted">Bevestig of de rekening betaald is</p>
        </div>
      </div>

      {/* Card stack (show shadow card behind) */}
      <div className="relative">
        {remaining > 1 && (
          <div className="absolute inset-0 top-2 rounded-xl border border-pw-border/30 bg-pw-surface/60 scale-[0.97]" />
        )}

        {/* Main card */}
        <div
          className={`relative rounded-xl border border-pw-border bg-pw-surface p-4 shadow-sm transition-all duration-300 ${
            swiping === 'right' ? 'translate-x-[120%] rotate-6 opacity-0' :
            swiping === 'left' ? '-translate-x-[120%] -rotate-6 opacity-0' : ''
          }`}
        >
          {/* Bank transaction */}
          <div className="flex items-start gap-3 pb-3 border-b border-pw-border/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pw-blue/10 shrink-0">
              <Building2 className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-pw-blue">{match.bank_name} transactie</p>
              <p className="text-[14px] font-semibold text-pw-navy truncate">{match.creditor_name}</p>
              <p className="text-[12px] text-pw-muted font-mono">{match.creditor_iban}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[15px] font-bold text-pw-navy">
                  € {(Math.abs(match.tx_amount) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[11px] text-pw-muted">
                  {new Date(match.tx_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
          </div>

          {/* Arrow connector */}
          <div className="flex justify-center py-2">
            <div className="flex items-center gap-1 text-pw-muted">
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="text-[10px] font-medium uppercase tracking-wider">Matcht met</span>
              <ArrowRight className="h-3.5 w-3.5 rotate-180" strokeWidth={1.5} />
            </div>
          </div>

          {/* Bill */}
          <div className="flex items-start gap-3 pt-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 shrink-0">
              <CreditCard className="h-5 w-5 text-orange-500" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-orange-600">Open rekening</p>
              <p className="text-[14px] font-semibold text-pw-navy truncate">{match.bill_vendor}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[15px] font-bold text-pw-navy">
                  € {(match.bill_amount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                </span>
                {match.bill_due_date && (
                  <span className="text-[11px] text-pw-muted">
                    vervaldatum {new Date(match.bill_due_date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {match.tx_description && (
            <p className="mt-3 pt-3 border-t border-pw-border/50 text-[11px] text-pw-muted truncate">
              {match.tx_description}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleAction('dismiss')}
              disabled={acting}
              className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-pw-border bg-white py-3 text-[13px] font-semibold text-pw-muted transition-colors hover:bg-red-50 hover:text-pw-red hover:border-red-200 disabled:opacity-50"
            >
              <X className="h-4 w-4" strokeWidth={2} />
              Geen match
            </button>
            <button
              onClick={() => handleAction('confirm')}
              disabled={acting}
              className="btn-press flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-pw-blue py-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {acting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <Check className="h-4 w-4" strokeWidth={2} />
              )}
              Betaald
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
