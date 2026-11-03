import { TrendingDown, TrendingUp, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { RATING, IMPACT, LEVEL3 } from '../lib/labels.js';
import { fmtPct, signClass } from '../lib/format.js';

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cx('min-w-0 rounded-xl border border-line bg-surface', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ icon: Icon, title, en, right, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />}
        <h3 className="truncate text-sm font-semibold text-ink">
          {title}
          {en && <span className="ml-2 text-xs font-normal text-ink-3">{en}</span>}
        </h3>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, children, en }) {
  return (
    <h2 className="mb-3 mt-8 flex items-center gap-2 text-base font-semibold text-ink first:mt-0">
      {Icon && <Icon className="h-4 w-4 text-accent" aria-hidden />}
      {children}
      {en && <span className="text-xs font-normal text-ink-3">{en}</span>}
    </h2>
  );
}

const TONE = {
  up: 'bg-up/12 text-up ring-up/25',
  'up-strong': 'bg-up/20 text-up ring-up/40',
  down: 'bg-down/12 text-down ring-down/25',
  neutral: 'bg-surface-3 text-ink-2 ring-line-strong',
  accent: 'bg-accent-soft text-accent ring-accent/30',
  info: 'bg-s1/12 text-s1 ring-s1/25',
  warn: 'bg-warn/12 text-warn ring-warn/30',
};

export function Badge({ tone = 'neutral', className, children, title }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONE[tone], className)}>
      {children}
    </span>
  );
}

export function RatingBadge({ rating, size = 'sm' }) {
  const r = RATING[rating] || { zh: rating, tone: 'neutral' };
  return (
    <Badge tone={r.tone} className={size === 'lg' ? 'px-2 py-1 text-xs' : ''}>
      <span className="font-semibold">{rating}</span>
      <span className="opacity-80">{r.zh}</span>
    </Badge>
  );
}

const IMPACT_ICON = { Bullish: TrendingUp, Bearish: TrendingDown, Neutral: Minus, Binary: ArrowUpRight };
const IMPACT_TONE = { Bullish: 'up', Bearish: 'down', Neutral: 'neutral', Binary: 'warn' };

export function ImpactBadge({ impact }) {
  const Icon = IMPACT_ICON[impact] || Minus;
  return (
    <Badge tone={IMPACT_TONE[impact] || 'neutral'}>
      <Icon className="h-3 w-3" aria-hidden />
      {impact} {IMPACT[impact]}
    </Badge>
  );
}

export function LevelBadge({ level, prefix = '' }) {
  const tone = level === 'High' ? 'accent' : level === 'Medium' ? 'info' : 'neutral';
  return (
    <Badge tone={tone}>
      {prefix}
      {LEVEL3[level] || level}
    </Badge>
  );
}

/** 帶正負號、箭頭與顏色的漲跌幅；顏色之外以箭頭與正負號傳達方向 */
export function Delta({ value, digits = 1, className, showIcon = true }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return <span className={cx('text-ink-3', className)}>—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cx('num inline-flex items-center gap-0.5', signClass(value), className)}>
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {fmtPct(value, digits)}
    </span>
  );
}

export function Stat({ label, value, sub, className }) {
  return (
    <div className={cx('min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2.5', className)}>
      <div className="truncate text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 truncate text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-ink-2">{sub}</div>}
    </div>
  );
}

export function KV({ k, v, className }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-1.5 text-sm', className)}>
      <span className="text-ink-3">{k}</span>
      <span className="num text-right text-ink">{v}</span>
    </div>
  );
}

export function BulletList({ items, className, marker = 'accent' }) {
  return (
    <ul className={cx('space-y-2 text-sm leading-relaxed text-ink-2', className)}>
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={cx('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', marker === 'up' ? 'bg-up' : marker === 'down' ? 'bg-down' : 'bg-accent')} aria-hidden />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyNote({ children }) {
  return <p className="px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}
