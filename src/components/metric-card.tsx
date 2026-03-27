'use client';

import { type ReactNode } from 'react';

/* ─── Mini Sparkline (pure SVG) ─── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 56, h = 24;
  const mx = Math.max(...data), mn = Math.min(...data), rng = mx - mn || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / rng) * (h - 4) - 2}`)
    .join(' ');
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Progress Ring (pure SVG) ─── */
function ProgressRing({ value, max, color }: { value: number; max: number; color: string }) {
  const size = 40, sw = 3.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={sw}
          className="stroke-pw-border/60"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
        style={{ color, letterSpacing: '-0.02em' }}
      >
        {value}/{max}
      </span>
    </div>
  );
}

/* ─── Color mappings for Tailwind classes ─── */
const COLOR_MAP = {
  blue: { iconBg: 'bg-pw-blue/[0.06] dark:bg-pw-blue/[0.15]', value: 'text-pw-blue', hex: '#2563EB' },
  red: { iconBg: 'bg-pw-red/[0.06] dark:bg-pw-red/[0.15]', value: 'text-pw-red', hex: '#DC2626' },
  amber: { iconBg: 'bg-amber-500/[0.06] dark:bg-amber-500/[0.15]', value: 'text-amber-600 dark:text-amber-400', hex: '#D97706' },
  green: { iconBg: 'bg-pw-green/[0.06] dark:bg-pw-green/[0.15]', value: 'text-pw-green', hex: '#059669' },
} as const;

type ColorKey = keyof typeof COLOR_MAP;

/* ─── MetricCard ─── */
export default function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
  sparkData,
  ring,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: ColorKey;
  sparkData?: number[];
  ring?: { value: number; max: number };
}) {
  const c = COLOR_MAP[color];

  return (
    <div className="rounded-[14px] border border-pw-border/60 bg-pw-surface p-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_2px_8px_rgba(0,0,0,0.04)]">
      {/* Icon + label */}
      <div className="mb-2.5 flex items-center gap-[7px]">
        <div className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${c.iconBg}`}>
          {icon}
        </div>
        <span className="text-[11.5px] font-medium tracking-[0.01em] text-pw-muted">
          {label}
        </span>
      </div>

      {/* Value + visual */}
      <div className="flex items-end justify-between">
        <div className="min-w-0">
          <p className={`text-[24px] font-extrabold leading-none tracking-[-0.03em] ${c.value}`}>
            {value}
          </p>
          {sub && (
            <p className="mt-1 truncate text-[11px] text-pw-muted">
              {sub}
            </p>
          )}
        </div>

        {sparkData && (
          <div className="mb-1 flex-shrink-0 opacity-90">
            <Sparkline data={sparkData} color={c.hex} />
          </div>
        )}
        {ring && (
          <div className="mb-0.5 flex-shrink-0">
            <ProgressRing value={ring.value} max={ring.max} color={c.hex} />
          </div>
        )}
      </div>
    </div>
  );
}
