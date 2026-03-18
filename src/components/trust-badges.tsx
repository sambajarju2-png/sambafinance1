'use client';

export default function TrustBadges({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${compact ? 'py-2' : 'py-4'}`}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge emoji="🇳🇱" label="Built in NL" />
        <Badge emoji="🇪🇺" label="EU Product" />
        <Badge icon="🛡️" label="GDPR / AVG" />
        <Badge icon="🔒" label="SOC 2 Type II" />
      </div>
      {!compact && (
        <p className="max-w-[300px] text-center text-[10px] text-pw-muted">
          Je gegevens worden veilig opgeslagen in Europa en verwerkt volgens de strengste privacystandaarden.
        </p>
      )}
    </div>
  );
}

function Badge({ emoji, icon, label }: { emoji?: string; icon?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-pw-border bg-pw-surface px-2.5 py-1">
      {emoji && <span className="text-[12px]">{emoji}</span>}
      {icon && <span className="text-[11px]">{icon}</span>}
      <span className="text-[10px] font-semibold text-pw-text">{label}</span>
    </div>
  );
}
