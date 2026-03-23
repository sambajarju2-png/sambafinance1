'use client';

import { useState, useEffect } from 'react';
import { Shield, ShieldAlert, AlertTriangle, ChevronLeft, Loader2, Eye, EyeOff, Landmark } from 'lucide-react';
import { detectGovBrand, getGovBrandInfo } from '@/lib/gov-brands';

interface BuddyBill {
  id: string;
  vendor: string;
  amount: number | null;
  currency: string;
  due_date: string;
  escalation_stage: string;
  category: string;
  status: string;
}

interface DashboardData {
  user_name: string;
  role: string;
  share_amounts: boolean;
  status: 'green' | 'red';
  summary: { total_outstanding: number; in_incasso: number; in_deurwaarder: number };
  bills: BuddyBill[];
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  incasso: { bg: 'bg-pw-red/10', text: 'text-pw-red' },
  deurwaarder: { bg: 'bg-red-100', text: 'text-[#991B1B]' },
};

export default function BuddyDashboardView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/buddy/dashboard?user_id=${userId}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          const d = await res.json();
          setError(d.error || 'Kon dashboard niet laden');
        }
      } catch { setError('Verbindingsfout'); }
      finally { setLoading(false); }
    }
    load();
  }, [userId]);

  if (loading) return <div className="skeleton h-[300px] rounded-card" />;

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-pw-blue">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Terug
        </button>
        <div className="rounded-card border border-pw-red/20 bg-red-50/50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-pw-red" strokeWidth={1.5} />
          <p className="text-[13px] text-pw-red">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statusColor = data.status === 'red' ? 'text-pw-red' : 'text-pw-green';
  const statusBg = data.status === 'red' ? 'bg-red-50' : 'bg-green-50';
  const statusRing = data.status === 'red' ? 'border-pw-red' : 'border-pw-green';

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-[13px] font-semibold text-pw-blue">
        <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Terug
      </button>

      {/* User header with status ring */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-5 text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${statusBg} border-2 ${statusRing}`}>
          <Shield className={`h-7 w-7 ${statusColor}`} strokeWidth={1.5} />
        </div>
        <h2 className="mt-3 text-[18px] font-bold text-pw-navy">{data.user_name}</h2>
        <p className="text-[12px] text-pw-muted capitalize">{data.role}</p>
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
          data.status === 'green' ? 'bg-green-50 text-pw-green' : 'bg-red-50 text-pw-red'
        }`}>
          <div className={`h-2 w-2 rounded-full ${data.status === 'green' ? 'bg-pw-green' : 'bg-pw-red'}`} />
          {data.status === 'green' ? 'Alles goed' : 'Actie nodig'}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-center">
          <p className="text-[20px] font-extrabold text-pw-navy">{data.summary.total_outstanding}</p>
          <p className="text-[10px] text-pw-muted">Openstaand</p>
        </div>
        <div className="rounded-card border border-pw-red/20 bg-red-50/30 p-3 text-center">
          <p className="text-[20px] font-extrabold text-pw-red">{data.summary.in_incasso}</p>
          <p className="text-[10px] text-pw-muted">Incasso</p>
        </div>
        <div className="rounded-card border border-[#991B1B]/20 bg-red-50/50 p-3 text-center">
          <p className="text-[20px] font-extrabold text-[#991B1B]">{data.summary.in_deurwaarder}</p>
          <p className="text-[10px] text-pw-muted">Deurwaarder</p>
        </div>
      </div>

      {/* Bills list — only incasso/deurwaarder */}
      {data.bills.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-pw-navy">Kritieke rekeningen</p>
          {data.bills.map((bill) => {
            const stage = STAGE_COLORS[bill.escalation_stage] || STAGE_COLORS.incasso;
            const govBrand = detectGovBrand(bill.vendor);
            const brandInfo = govBrand ? getGovBrandInfo(govBrand) : null;
            const dueDisplay = new Date(bill.due_date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

            return (
              <div key={bill.id} className="relative overflow-hidden rounded-card border border-pw-border bg-pw-surface px-3.5 py-3"
                style={brandInfo ? { borderColor: `${brandInfo.color}30`, boxShadow: `0 0 12px ${brandInfo.color}10` } : undefined}>
                {/* Brand stripe */}
                {brandInfo && (
                  <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: brandInfo.color }} />
                )}

                <div className="flex items-center gap-3" style={brandInfo ? { marginLeft: 4 } : undefined}>
                  {/* Icon */}
                  {brandInfo ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-input flex-shrink-0" style={{ background: brandInfo.colorLight }}>
                      {brandInfo.brand === 'cjib' ? (
                        <ShieldAlert className="h-4 w-4" style={{ color: brandInfo.color }} strokeWidth={1.5} />
                      ) : (
                        <Landmark className="h-4 w-4" style={{ color: brandInfo.color }} strokeWidth={1.5} />
                      )}
                    </div>
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-input flex-shrink-0 ${stage.bg}`}>
                      <AlertTriangle className={`h-4 w-4 ${stage.text}`} strokeWidth={1.5} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-pw-text truncate">{bill.vendor}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${bill.escalation_stage === 'deurwaarder' ? 'bg-[#991B1B]' : 'bg-pw-red'}`} />
                      <span className={`text-[11px] font-semibold ${stage.text}`}>
                        {bill.escalation_stage === 'deurwaarder' ? 'Deurwaarder' : 'Incasso'}
                      </span>
                    </div>
                  </div>

                  {/* Amount + date */}
                  <div className="text-right flex-shrink-0">
                    {bill.amount !== null ? (
                      <p className="text-[15px] font-bold text-pw-text">
                        € {(bill.amount / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <EyeOff className="h-3 w-3 text-pw-muted" strokeWidth={1.5} />
                        <span className="text-[11px] text-pw-muted">Verborgen</span>
                      </div>
                    )}
                    <p className="text-[11px] font-medium text-pw-red">{dueDisplay}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-pw-green/20 bg-green-50/30 p-6 text-center">
          <Shield className="mx-auto mb-2 h-8 w-8 text-pw-green" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-pw-green">Geen kritieke rekeningen</p>
          <p className="mt-1 text-[12px] text-pw-muted">Er zijn geen rekeningen in incasso of bij de deurwaarder.</p>
        </div>
      )}

      {/* Amounts hidden notice */}
      {!data.share_amounts && data.bills.length > 0 && (
        <div className="flex items-center gap-2 rounded-card bg-pw-bg border border-pw-border p-3">
          <EyeOff className="h-3.5 w-3.5 text-pw-muted flex-shrink-0" strokeWidth={1.5} />
          <p className="text-[11px] text-pw-muted">Bedragen zijn verborgen door de gebruiker</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-pw-muted text-center">
        Je hebt alleen-lezen toegang. Je kunt niets wijzigen of betalen.
      </p>
    </div>
  );
}
