'use client';

import { HelpCircle, ExternalLink, Phone } from 'lucide-react';

const RESOURCES = [
  { name: 'Juridisch Loket', desc: 'Gratis juridisch advies', url: 'https://www.juridischloket.nl', phone: '0900-8020' },
  { name: 'Nibud', desc: 'Nationaal Instituut voor Budgetvoorlichting', url: 'https://www.nibud.nl', phone: null },
  { name: 'SchuldHulpMaatje', desc: 'Vrijwillige hulp bij schulden', url: 'https://www.schuldhulpmaatje.nl', phone: null },
  { name: 'Geldfit', desc: 'Check of je geldzaken op orde zijn', url: 'https://www.geldfit.nl', phone: null },
  { name: 'De Nationale Ombudsman', desc: 'Klachten over overheidsinstanties', url: 'https://www.nationaleombudsman.nl', phone: '0800-3355' },
];

export default function HelpResources() {
  return (
    <div className="rounded-card border border-pw-border bg-pw-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className="h-4 w-4 text-pw-green" strokeWidth={1.5} />
        <p className="text-[14px] font-semibold text-pw-text">Hulpbronnen</p>
      </div>
      <p className="mb-3 text-[11px] text-pw-muted">Gratis hulp bij financiele problemen en schulden.</p>
      <div className="space-y-2">
        {RESOURCES.map((r) => (
          <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-card border border-pw-border px-3.5 py-3 transition-colors hover:bg-pw-bg">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-pw-text">{r.name}</p>
              <p className="text-[10px] text-pw-muted">{r.desc}</p>
              {r.phone && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-pw-blue">
                  <Phone className="h-2.5 w-2.5" strokeWidth={2} />{r.phone}
                </p>
              )}
            </div>
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-pw-muted" strokeWidth={1.5} />
          </a>
        ))}
      </div>
    </div>
  );
}
