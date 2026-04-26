'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Share2, Download, X, Loader2, Trophy, Flame, Shield, CreditCard } from 'lucide-react';
import { formatCents } from '@/lib/bills';

interface ShareData {
  display_name: string | null;
  unlocked_count: number;
  total_achievements: number;
  total_paid: number;
  saved_cents: number;
  streak_current: number;
  streak_best: number;
  member_since: string;
  achievements: Array<{ key: string; icon: string; unlocked_at: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AchievementDiploma({ open, onClose }: Props) {
  const t = useTranslations('diploma');
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/achievements/share')
      .then(r => r.json())
      .then(d => { setData(d); requestAnimationFrame(() => drawDiploma(d)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const drawDiploma = useCallback((d: ShareData) => {
    const canvas = canvasRef.current;
    if (!canvas || !d) return;

    const W = 720;
    const H = 960;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0A2540');
    grad.addColorStop(0.5, '#0F3460');
    grad.addColorStop(1, '#162447');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative circles
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.arc(W + 30, -30, 200, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-40, H + 20, 180, 0, Math.PI * 2); ctx.fill();

    // "Certified by" label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText('CERTIFICAAT VAN', 48, 72);

    // PayWatch logo
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('PayWatch', 48, 116);

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(48, 140, W - 96, 1);

    // "Awarded to"
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '16px system-ui, -apple-system, sans-serif';
    ctx.fillText(t('awardedTo'), 48, 190);

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.fillText(d.display_name || t('anonymousUser'), 48, 228);

    // Title
    const pct = Math.round((d.unlocked_count / d.total_achievements) * 100);
    const titleText = pct >= 90 ? t('titleMaster') : pct >= 60 ? t('titleExpert') : pct >= 30 ? t('titleRising') : t('titleStarter');
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.fillText(titleText, 48, 262);

    // Stats boxes
    const boxW = (W - 96 - 20) / 2;
    const boxH = 90;
    const boxY = 300;

    const stats = [
      { label: t('badges'), value: `${d.unlocked_count}/${d.total_achievements}`, color: '#F59E0B' },
      { label: t('billsPaid'), value: String(d.total_paid), color: '#3B82F6' },
      { label: t('bestStreak'), value: `${d.streak_best}d`, color: '#F97316' },
      { label: t('saved'), value: formatCents(d.saved_cents), color: '#10B981' },
    ];

    stats.forEach((stat, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 48 + col * (boxW + 20);
      const y = boxY + row * (boxH + 12);

      // Box background
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, x, y, boxW, boxH, 16);
      ctx.fill();

      // Color dot
      ctx.fillStyle = stat.color;
      ctx.beginPath(); ctx.arc(x + 20, y + 24, 5, 0, Math.PI * 2); ctx.fill();

      // Value
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(stat.value, x + 20, y + 58);

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(stat.label, x + 20, y + 78);
    });

    // Achievement icons
    const iconsY = boxY + 2 * (boxH + 12) + 24;
    const iconSize = 44;
    const iconGap = 8;
    const iconsPerRow = Math.floor((W - 96 + iconGap) / (iconSize + iconGap));

    d.achievements.slice(0, 12).forEach((a, i) => {
      const col = i % iconsPerRow;
      const row = Math.floor(i / iconsPerRow);
      const x = 48 + col * (iconSize + iconGap);
      const y = iconsY + row * (iconSize + iconGap);

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(ctx, x, y, iconSize, iconSize, 10);
      ctx.fill();

      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.icon, x + iconSize / 2, y + iconSize / 2 + 7);
      ctx.textAlign = 'left';
    });

    // Footer divider
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(48, H - 60, W - 96, 1);

    // Footer text
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillText('paywatch.app', 48, H - 30);

    const sinceText = `${t('since')} ${new Date(d.member_since).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`;
    ctx.textAlign = 'right';
    ctx.fillText(sinceText, W - 48, H - 30);
    ctx.textAlign = 'left';
  }, [t]);

  const getBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
  }, []);

  async function handleShare() {
    if (!data) return;
    setSharing(true);
    try {
      if (data) drawDiploma(data);
      await new Promise(r => setTimeout(r, 50)); // let canvas render
      const blob = await getBlob();

      if (blob && navigator.share) {
        const file = new File([blob], 'paywatch-diploma.png', { type: 'image/png' });
        try {
          await navigator.share({
            title: t('shareTitle'),
            text: t('shareText', { count: String(data.unlocked_count), total: String(data.total_achievements) }),
            files: [file],
          });
        } catch (e) {
          // share cancelled or not supported with files — try without files
          if (e instanceof Error && e.name !== 'AbortError') {
            await navigator.share({
              title: t('shareTitle'),
              text: t('shareText', { count: String(data.unlocked_count), total: String(data.total_achievements) }),
              url: 'https://paywatch.app',
            });
          }
        }
      } else if (blob) {
        downloadBlob(blob);
      }
    } catch { /* silent */ } finally { setSharing(false); }
  }

  async function handleDownload() {
    if (data) drawDiploma(data);
    await new Promise(r => setTimeout(r, 50));
    const blob = await getBlob();
    if (blob) downloadBlob(blob);
  }

  function downloadBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'paywatch-diploma.png'; a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  const pct = data ? Math.round((data.unlocked_count / data.total_achievements) * 100) : 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-3 top-[6%] bottom-auto z-50 max-h-[88vh] overflow-y-auto rounded-card-lg bg-pw-surface shadow-xl">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 p-1.5 rounded-full bg-pw-bg/80">
          <X className="h-4 w-4 text-pw-muted" strokeWidth={1.5} />
        </button>

        {loading || !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-pw-blue" strokeWidth={1.5} />
          </div>
        ) : (
          <div className="p-4">
            {/* Preview card (matches what canvas generates) */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A2540] via-[#0F3460] to-[#162447] p-5">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.04]" />
              <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/[0.04]" />

              <div className="relative">
                <p className="text-[10px] font-bold tracking-[0.15em] text-white/35 uppercase">{t('certifiedBy')}</p>
                <p className="text-[20px] font-extrabold text-white tracking-tight">PayWatch</p>
              </div>

              <div className="relative mt-4 mb-4 border-t border-white/10 pt-4">
                <p className="text-[11px] text-white/45">{t('awardedTo')}</p>
                <p className="mt-0.5 text-[18px] font-bold text-white">{data.display_name || t('anonymousUser')}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-amber-400">
                  {pct >= 90 ? t('titleMaster') : pct >= 60 ? t('titleExpert') : pct >= 30 ? t('titleRising') : t('titleStarter')}
                </p>
              </div>

              <div className="relative grid grid-cols-2 gap-2.5 mb-4">
                <StatBox icon={<Trophy className="h-3 w-3 text-amber-400" strokeWidth={2} />} value={`${data.unlocked_count}/${data.total_achievements}`} label={t('badges')} />
                <StatBox icon={<CreditCard className="h-3 w-3 text-blue-400" strokeWidth={2} />} value={String(data.total_paid)} label={t('billsPaid')} />
                <StatBox icon={<Flame className="h-3 w-3 text-orange-400" strokeWidth={2} />} value={`${data.streak_best}d`} label={t('bestStreak')} />
                <StatBox icon={<Shield className="h-3 w-3 text-green-400" strokeWidth={2} />} value={formatCents(data.saved_cents)} label={t('saved')} />
              </div>

              {data.achievements.length > 0 && (
                <div className="relative flex flex-wrap gap-1.5 mb-3">
                  {data.achievements.slice(0, 12).map((a) => (
                    <span key={a.key} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.08] text-[14px]">{a.icon}</span>
                  ))}
                  {data.achievements.length > 12 && (
                    <span className="flex h-7 items-center px-1.5 rounded-lg bg-white/[0.08] text-[10px] font-bold text-white/50">+{data.achievements.length - 12}</span>
                  )}
                </div>
              )}

              <div className="relative flex items-center justify-between pt-2.5 border-t border-white/10">
                <p className="text-[10px] text-white/25">paywatch.app</p>
                <p className="text-[10px] text-white/25">{t('since')} {new Date(data.member_since).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}</p>
              </div>
            </div>

            {/* Hidden canvas for image generation */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Action buttons */}
            <div className="mt-4 flex gap-3">
              <button onClick={handleShare} disabled={sharing}
                className="btn-press flex flex-1 items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                {sharing ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> : <Share2 className="h-4 w-4" strokeWidth={1.5} />}
                {t('share')}
              </button>
              <button onClick={handleDownload} disabled={sharing}
                className="btn-press flex items-center justify-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-[13px] font-semibold text-pw-text disabled:opacity-50">
                <Download className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatBox({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/[0.06] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">{icon}</div>
      <p className="text-[15px] font-bold text-white">{value}</p>
      <p className="text-[9px] text-white/35">{label}</p>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
