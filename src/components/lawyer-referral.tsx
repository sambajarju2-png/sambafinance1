'use client';

import { useState, useEffect } from 'react';
import { Scale, ExternalLink, AlertTriangle } from 'lucide-react';

interface LawyerReferralProps {
  stage: string;
  gemeente: string | null;
}

interface Advocaat {
  kantoor_naam: string;
  website_url: string;
}

/**
 * Shows lawyer referral cards when bill is in incasso or deurwaarder stage.
 * Fetches lawyers based on user's gemeente/city.
 */
export default function LawyerReferral({ stage, gemeente }: LawyerReferralProps) {
  const [advocaten, setAdvocaten] = useState<Advocaat[]>([]);
  const [loading, setLoading] = useState(false);

  // Only show for incasso or deurwaarder
  const showLawyers = stage === 'incasso' || stage === 'deurwaarder';

  useEffect(() => {
    if (!showLawyers || !gemeente) return;

    async function fetch_advocaten() {
      setLoading(true);
      try {
        const res = await fetch(`/api/advocaten?stad=${encodeURIComponent(gemeente!)}`);
        if (res.ok) {
          const data = await res.json();
          setAdvocaten(data.advocaten || []);
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    fetch_advocaten();
  }, [showLawyers, gemeente]);

  if (!showLawyers) return null;

  return (
    <div className="mt-4 rounded-card border-2 border-pw-red/20 bg-red-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-pw-red" strokeWidth={2} />
        <p className="text-[14px] font-bold text-pw-red">
          {stage === 'deurwaarder' ? 'Deurwaarder betrokken' : 'Incassobureau ingeschakeld'}
        </p>
      </div>

      <p className="text-[12px] text-pw-text leading-relaxed mb-3">
        Bij een {stage === 'deurwaarder' ? 'deurwaarder' : 'incasso'} fase is het verstandig om juridisch advies in te winnen.
        Hieronder vind je advocatenkantoren bij jou in de buurt die gespecialiseerd zijn in civiel recht.
      </p>

      {!gemeente && (
        <div className="rounded-card border border-pw-border bg-pw-surface p-3 text-[12px] text-pw-muted">
          <Scale className="inline h-3.5 w-3.5 mr-1" strokeWidth={1.5} />
          Stel je gemeente in via Instellingen om advocaten in jouw buurt te zien.
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-[52px] rounded-card" />)}
        </div>
      )}

      {advocaten.length > 0 && (
        <div className="space-y-2">
          {advocaten.map((a) => (
            <a
              key={a.kantoor_naam}
              href={a.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 transition-colors hover:bg-pw-bg"
            >
              <Scale className="h-4 w-4 flex-shrink-0 text-pw-navy" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-pw-text truncate">{a.kantoor_naam}</p>
                <p className="text-[10px] text-pw-muted truncate">{a.website_url}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
            </a>
          ))}
        </div>
      )}

      {gemeente && !loading && advocaten.length === 0 && (
        <p className="text-[11px] text-pw-muted">
          Geen advocatenkantoren gevonden voor {gemeente}. Bel het Juridisch Loket: 0900-8020.
        </p>
      )}

      <div className="mt-3 rounded-card bg-pw-bg p-3">
        <p className="text-[11px] text-pw-muted leading-relaxed">
          <strong>Juridisch Loket:</strong> 0900-8020 (gratis) — voor gratis juridisch advies.
          <br />
          <strong>Nibud:</strong> nibud.nl — voor financieel advies en schuldhulp.
        </p>
      </div>
    </div>
  );
}
