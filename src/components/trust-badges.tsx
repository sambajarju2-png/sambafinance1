'use client';

import { Shield, Lock, Globe, MapPin } from 'lucide-react';

/** Icons-only badges — shown at the top of login/signup */
export default function TrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'py-2' : 'py-4'}`}>
      <div className="flex items-center gap-1.5 rounded-full border border-pw-border bg-pw-surface px-2.5 py-1">
        <MapPin className="h-3 w-3 text-pw-blue" strokeWidth={2} />
        <span className="text-[10px] font-semibold text-pw-text">Built in NL</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-pw-border bg-pw-surface px-2.5 py-1">
        <Globe className="h-3 w-3 text-pw-blue" strokeWidth={2} />
        <span className="text-[10px] font-semibold text-pw-text">EU Product</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-pw-border bg-pw-surface px-2.5 py-1">
        <Shield className="h-3 w-3 text-pw-green" strokeWidth={2} />
        <span className="text-[10px] font-semibold text-pw-text">GDPR / AVG</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-pw-border bg-pw-surface px-2.5 py-1">
        <Lock className="h-3 w-3 text-pw-purple" strokeWidth={2} />
        <span className="text-[10px] font-semibold text-pw-text">SOC 2 Type II</span>
      </div>
    </div>
  );
}

/** Text disclaimer — shown below the login/signup form */
export function TrustText() {
  return (
    <p className="py-4 text-center text-[10px] text-pw-muted max-w-[300px] mx-auto">
      Je gegevens worden veilig opgeslagen in Europa en verwerkt volgens de strengste privacystandaarden.
    </p>
  );
}
