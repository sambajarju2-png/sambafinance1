'use client';

import { useState, useEffect } from 'react';
import { Shield, UserPlus, Trash2, Copy, Check, Loader2, Share2, Users, Bell, Eye, EyeOff, ChevronRight, ExternalLink, LayoutDashboard } from 'lucide-react';
import BuddyDashboardView from '@/components/buddy-dashboard-view';

interface BuddyOf {
  id: string;
  user_id: string;
  owner_name: string;
  role: string;
  share_amounts: boolean;
  notify_on_incasso: boolean;
}

interface Buddy {
  id: string;
  user_id: string;
  buddy_user_id: string | null;
  buddy_name: string | null;
  buddy_email: string | null;
  role: string;
  invite_code: string;
  status: string;
  notify_on_incasso: boolean;
  share_amounts: boolean;
  created_at: string;
  accepted_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  partner: 'Partner',
  ouder: 'Ouder',
  schuldhulpmaatje: 'Schuldhulpmaatje',
  anders: 'Anders',
};

export default function BuddySettings() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [buddyOf, setBuddyOf] = useState<BuddyOf[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDashboard, setViewingDashboard] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState('partner');
  const [inviteShareAmounts, setInviteShareAmounts] = useState(false);
  const [inviteNotifyIncasso, setInviteNotifyIncasso] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newInviteCode, setNewInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [maxBuddies] = useState(3);
  const [statuses, setStatuses] = useState<Record<string, 'green' | 'red'>>({});

  async function loadBuddies() {
    try {
      const res = await fetch('/api/buddies');
      if (res.ok) {
        const data = await res.json();
        setBuddies(data.buddies || []);
        setBuddyOf(data.buddy_of || []);
        setStatuses(data.statuses || {});
      }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { loadBuddies(); }, []);

  async function handleCreateInvite() {
    setCreating(true);
    try {
      const res = await fetch('/api/buddies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole, share_amounts: inviteShareAmounts, notify_on_incasso: inviteNotifyIncasso }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewInviteCode(data.buddy.invite_code);
        loadBuddies();
      } else {
        const data = await res.json();
        alert(data.error || 'Er ging iets mis');
      }
    } catch {} finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Weet je zeker dat je deze buddy wilt verwijderen?')) return;
    setDeleting(id);
    try {
      await fetch('/api/buddies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      loadBuddies();
    } catch {} finally { setDeleting(null); }
  }

  async function handleToggle(id: string, field: 'share_amounts' | 'notify_on_incasso', currentVal: boolean) {
    try {
      await fetch('/api/buddies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: !currentVal }),
      });
      setBuddies((prev) => prev.map((b) => b.id === id ? { ...b, [field]: !currentVal } : b));
    } catch {}
  }

  function handleCopy(code: string) {
    const url = `${window.location.origin}/buddy/accept/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare(code: string) {
    const url = `${window.location.origin}/buddy/accept/${code}`;
    const text = 'Ik nodig je uit als mijn PayWatch Buddy. Met deze link kun je mijn voortgang volgen en me helpen op koers te blijven.';
    if (navigator.share) {
      try { await navigator.share({ title: 'PayWatch Buddy uitnodiging', text, url }); } catch {}
    } else {
      handleCopy(code);
    }
  }

  const accepted = buddies.filter((b) => b.status === 'accepted');
  const pending = buddies.filter((b) => b.status === 'pending');

  if (loading) return <div className="skeleton h-[300px] rounded-card" />;

  // Show buddy dashboard if viewing
  if (viewingDashboard) {
    return <BuddyDashboardView userId={viewingDashboard} onBack={() => setViewingDashboard(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-input bg-pw-blue/10">
            <Shield className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-pw-text">Veiligheidsnetwerk</p>
            <p className="text-[11px] text-pw-muted">Geef iemand die je vertrouwt een vangnet</p>
          </div>
        </div>

        {/* Safety Circle */}
        {accepted.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="relative" style={{ width: 140, height: 140 }}>
              <div className="absolute inset-0 rounded-full" style={{ border: '2px dashed var(--border)' }} />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-pw-blue text-[13px] font-extrabold text-white"
                style={{ boxShadow: '0 0 0 3px var(--surface), 0 0 0 5px rgba(37,99,235,0.25)' }}>
                JIJ
              </div>
              {accepted.map((b, i) => {
                const angle = -90 + (i * (360 / Math.max(accepted.length, 2)));
                const rad = (angle * Math.PI) / 180;
                const x = 70 + 52 * Math.cos(rad);
                const y = 70 + 52 * Math.sin(rad);
                const s = statuses[b.id] || 'green';
                const ringColor = s === 'green' ? 'var(--green)' : 'var(--red)';
                const initials = (b.buddy_name || 'B').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div key={b.id} className="absolute flex h-9 w-9 items-center justify-center rounded-full bg-pw-surface text-[11px] font-bold text-pw-navy"
                    style={{ left: x - 18, top: y - 18, boxShadow: `0 0 0 2.5px ${ringColor}` }}>
                    {initials}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {accepted.length > 0 && (
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-pw-green" /><span className="text-[10px] text-pw-muted">Alles goed</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-pw-red" /><span className="text-[10px] text-pw-muted">Actie nodig</span></div>
          </div>
        )}
      </div>

      {/* Buddy of — people who added me as buddy */}
      {buddyOf.length > 0 && (
        <div className="rounded-card border border-pw-blue/20 bg-pw-blue/5">
          <div className="px-4 py-3 border-b border-pw-blue/10">
            <p className="text-[13px] font-semibold text-pw-navy">Je bent buddy van</p>
          </div>
          {buddyOf.map((b) => {
            const initials = b.owner_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-pw-blue/10 last:border-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-blue/10 text-[12px] font-bold text-pw-blue">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-pw-text truncate">{b.owner_name}</p>
                  <p className="text-[10px] text-pw-muted capitalize">{ROLE_LABELS[b.role] || b.role}</p>
                </div>
                <button onClick={() => setViewingDashboard(b.user_id)}
                  className="btn-press flex items-center gap-1.5 rounded-button bg-pw-blue px-3 py-2 text-[11px] font-semibold text-white">
                  <LayoutDashboard className="h-3 w-3" strokeWidth={1.5} />
                  Dashboard
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Buddy list — accepted */}
      {accepted.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface">
          <div className="flex items-center justify-between px-4 py-3 border-b border-pw-border">
            <p className="text-[13px] font-semibold text-pw-text">Je buddies</p>
            <span className="text-[11px] text-pw-muted">{accepted.length}/{maxBuddies}</span>
          </div>
          {accepted.map((b) => {
            const initials = (b.buddy_name || 'B').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
            const s = statuses[b.id] || 'green';
            return (
              <div key={b.id} className="px-4 py-3 border-b border-pw-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-bg text-[12px] font-bold text-pw-blue"
                    style={{ boxShadow: `0 0 0 2px ${s === 'green' ? 'var(--green)' : 'var(--red)'}` }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-pw-text truncate">{b.buddy_name || 'Onbekend'}</p>
                    <p className="text-[10px] text-pw-muted">{ROLE_LABELS[b.role] || b.role}</p>
                  </div>
                  <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-pw-muted hover:text-pw-red hover:bg-red-50 transition-colors">
                    {deleting === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  </button>
                </div>
                {/* Sharing controls */}
                <div className="mt-3 flex gap-3 ml-[52px]">
                  <button onClick={() => handleToggle(b.id, 'share_amounts', b.share_amounts)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${b.share_amounts ? 'bg-pw-blue/10 text-pw-blue' : 'bg-pw-bg text-pw-muted'}`}>
                    {b.share_amounts ? <Eye className="h-3 w-3" strokeWidth={1.5} /> : <EyeOff className="h-3 w-3" strokeWidth={1.5} />}
                    {b.share_amounts ? 'Bedragen zichtbaar' : 'Bedragen verborgen'}
                  </button>
                  <button onClick={() => handleToggle(b.id, 'notify_on_incasso', b.notify_on_incasso)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${b.notify_on_incasso ? 'bg-pw-blue/10 text-pw-blue' : 'bg-pw-bg text-pw-muted'}`}>
                    <Bell className="h-3 w-3" strokeWidth={1.5} />
                    {b.notify_on_incasso ? 'Incasso-alert aan' : 'Incasso-alert uit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="rounded-card border border-pw-border bg-pw-surface">
          <div className="px-4 py-3 border-b border-pw-border">
            <p className="text-[13px] font-semibold text-pw-text">Openstaande uitnodigingen</p>
          </div>
          {pending.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-b border-pw-border/50 last:border-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pw-border/30">
                <UserPlus className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-pw-text">{ROLE_LABELS[b.role] || b.role}</p>
                <p className="text-[10px] text-pw-muted font-mono">{b.invite_code}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => handleShare(b.invite_code)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-pw-blue/10 text-pw-blue">
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button onClick={() => handleCopy(b.invite_code)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-pw-bg text-pw-muted">
                  {copied ? <Check className="h-3.5 w-3.5 text-pw-green" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
                </button>
                <button onClick={() => handleDelete(b.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:text-pw-red">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite button */}
      {buddies.length < maxBuddies && !showInvite && (
        <button onClick={() => setShowInvite(true)}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white">
          <UserPlus className="h-4 w-4" strokeWidth={1.5} />
          Buddy uitnodigen
        </button>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="rounded-card border border-pw-blue/30 bg-pw-blue/5 p-4">
          <p className="text-[13px] font-semibold text-pw-navy mb-3">Nieuwe buddy uitnodigen</p>
          <p className="text-[11px] text-pw-muted mb-3">Kies een rol voor je buddy</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['partner', 'ouder', 'schuldhulpmaatje', 'anders'].map((r) => (
              <button key={r} onClick={() => setInviteRole(r)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${inviteRole === r ? 'bg-pw-blue text-white' : 'bg-pw-surface border border-pw-border text-pw-muted'}`}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Share settings for this invite */}
          <p className="text-[11px] font-semibold text-pw-muted uppercase tracking-wider mb-2">Wat mag deze buddy zien?</p>
          <div className="space-y-2.5 mb-4">
            <div className="flex items-center justify-between rounded-card bg-pw-surface border border-pw-border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                {inviteShareAmounts ? <Eye className="h-3.5 w-3.5 text-pw-blue" strokeWidth={1.5} /> : <EyeOff className="h-3.5 w-3.5 text-pw-muted" strokeWidth={1.5} />}
                <div>
                  <p className="text-[12px] font-semibold text-pw-text">Bedragen tonen</p>
                  <p className="text-[10px] text-pw-muted">Buddy kan exacte bedragen zien</p>
                </div>
              </div>
              <button onClick={() => setInviteShareAmounts(!inviteShareAmounts)}
                className={`relative h-6 w-10 rounded-full transition-colors ${inviteShareAmounts ? 'bg-pw-blue' : 'bg-pw-border'}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${inviteShareAmounts ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-card bg-pw-surface border border-pw-border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Bell className={`h-3.5 w-3.5 ${inviteNotifyIncasso ? 'text-pw-blue' : 'text-pw-muted'}`} strokeWidth={1.5} />
                <div>
                  <p className="text-[12px] font-semibold text-pw-text">Incasso-alert</p>
                  <p className="text-[10px] text-pw-muted">Melding als een rekening naar incasso gaat</p>
                </div>
              </div>
              <button onClick={() => setInviteNotifyIncasso(!inviteNotifyIncasso)}
                className={`relative h-6 w-10 rounded-full transition-colors ${inviteNotifyIncasso ? 'bg-pw-blue' : 'bg-pw-border'}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${inviteNotifyIncasso ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {newInviteCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-input border border-pw-border bg-pw-surface px-3 py-2.5">
                <span className="flex-1 text-[11px] text-pw-muted truncate font-mono">
                  {window.location.origin}/buddy/accept/{newInviteCode}
                </span>
                <button onClick={() => handleCopy(newInviteCode)}
                  className="flex-shrink-0 rounded-button bg-pw-blue px-3 py-1.5 text-[11px] font-semibold text-white">
                  {copied ? 'Gekopieerd' : 'Kopiëren'}
                </button>
              </div>
              <button onClick={() => handleShare(newInviteCode)}
                className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-green px-4 py-2.5 text-[13px] font-semibold text-white">
                <Share2 className="h-4 w-4" strokeWidth={1.5} />
                Deel via WhatsApp
              </button>
              <button onClick={() => { setShowInvite(false); setNewInviteCode(null); }}
                className="w-full text-center text-[12px] text-pw-muted">Sluiten</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleCreateInvite} disabled={creating}
                className="btn-press flex-1 flex items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />}
                Maak uitnodiging
              </button>
              <button onClick={() => setShowInvite(false)}
                className="rounded-button border border-pw-border px-4 py-2.5 text-[13px] font-semibold text-pw-muted">
                Annuleren
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info: What buddies see */}
      <div className="rounded-card border border-pw-border bg-pw-surface p-4">
        <p className="text-[13px] font-semibold text-pw-text mb-3">Wat ziet een Buddy?</p>
        <div className="space-y-2.5">
          {[
            { icon: Eye, text: 'Alleen-lezen overzicht van je schulden', color: 'text-pw-blue' },
            { icon: Bell, text: 'Melding als een rekening naar incasso gaat', color: 'text-pw-blue' },
            { icon: Shield, text: 'Kan niets wijzigen of betalen', color: 'text-pw-green' },
            { icon: EyeOff, text: 'Bedragen standaard verborgen (instelbaar)', color: 'text-pw-muted' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <item.icon className={`h-3.5 w-3.5 flex-shrink-0 ${item.color}`} strokeWidth={1.5} />
              <span className="text-[12px] text-pw-text">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {buddies.length === 0 && !showInvite && (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-blue/10 mb-3">
            <Users className="h-7 w-7 text-pw-blue" strokeWidth={1.5} />
          </div>
          <p className="text-[14px] font-semibold text-pw-text">Nog geen buddies</p>
          <p className="mt-1 max-w-[260px] text-[12px] text-pw-muted">
            Nodig iemand uit die je vertrouwt als vangnet. Ze krijgen een melding als een rekening escaleert.
          </p>
        </div>
      )}
    </div>
  );
}
