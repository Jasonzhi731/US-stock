import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from './ui.jsx';
import { fmtUsd } from '../lib/format.js';

// ---------- 基礎工具 ----------

export function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function niceTicks(min, max, count = 4) {
  if (max === min) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const ticks = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(10)));
  return ticks;
}

/** 一維標籤避讓：讓相鄰標籤至少相距 gap，並限制在 [lo, hi] */
export function spread(items, gap, lo, hi) {
  const sorted = items.map((it, i) => ({ ...it, i, pos: it.pos })).sort((a, b) => a.pos - b.pos);
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    for (let k = 1; k < sorted.length; k++) {
      const overlap = gap - (sorted[k].pos - sorted[k - 1].pos);
      if (overlap > 0.5) {
        sorted[k - 1].pos -= overlap / 2;
        sorted[k].pos += overlap / 2;
        moved = true;
      }
    }
    for (const s of sorted) s.pos = Math.min(hi, Math.max(lo, s.pos));
    if (!moved) break;
  }
  return sorted;
}

function roundedTopBar(x, y, w, h, r = 4) {
  const rr = Math.min(r, w / 2, h);
  const y0 = y + h;
  return `M${x},${y0} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y0} Z`;
}

export function ChartTooltip({ tip, width }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x + 12, 4), Math.max(width - 190, 4));
  return (
    <div className="pointer-events-none absolute z-20 w-[180px] rounded-lg border border-line-strong bg-surface px-3 py-2 text-xs shadow-xl" style={{ left, top: Math.max(tip.y - 10, 0) }} role="status">
      {tip.title && <div className="mb-1 font-semibold text-ink">{tip.title}</div>}
      {tip.rows.map(([k, v, swatch], i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-3">
            {swatch && <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />}
            {k}
          </span>
          <span className="num text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, className }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2', className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cx('inline-block', it.line ? 'h-0.5 w-3.5 rounded' : 'h-2.5 w-2.5 rounded-sm')} style={{ background: it.color }} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------- 直條圖（單一系列，估計值以斜線紋理區隔） ----------

export function ColumnChart({ data, format = (v) => v, height = 190, color = 'var(--series-1)', ariaLabel }) {
  const [ref, width] = useWidth();
  const [tip, setTip] = useState(null);
  const m = { l: 46, r: 8, t: 22, b: 28 };
  const iw = Math.max(width - m.l - m.r, 10);
  const ih = height - m.t - m.b;
  const max = Math.max(...data.map((d) => d.value)) * 1.12;
  const ticks = niceTicks(0, max, 4);
  const yMax = ticks[ticks.length - 1] || max;
  const y = (v) => m.t + ih - (v / yMax) * ih;
  const band = iw / data.length;
  const bw = Math.min(24, band * 0.55);
  const lastActual = data.map((d) => !d.estimate).lastIndexOf(true);
  const showLabel = (i) => i === lastActual || data[i].estimate;

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            <pattern id="hatch-est" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={color} opacity="0.28" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2" opacity="0.7" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize="10" fill="var(--ink-3)">{format(t, true)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx0 = m.l + band * i + band / 2;
            const h = Math.max(ih - (y(d.value) - m.t), 1);
            return (
              <g key={d.label}>
                <path d={roundedTopBar(cx0 - bw / 2, y(d.value), bw, h)} fill={d.estimate ? 'url(#hatch-est)' : color} opacity={tip && tip.i !== i ? 0.55 : 1} />
                {showLabel(i) && (
                  <text x={cx0} y={y(d.value) - 6} textAnchor="middle" className="num" fontSize="10.5" fontWeight="600" fill="var(--ink)">{format(d.value)}</text>
                )}
                <text x={cx0} y={height - 9} textAnchor="middle" fontSize="10.5" fill={d.estimate ? 'var(--ink-3)' : 'var(--ink-2)'}>{d.label}</text>
                <rect
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={ih}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const box = ref.current.getBoundingClientRect();
                    setTip({ i, x: e.clientX - box.left, y: e.clientY - box.top, title: `${d.label}${d.estimate ? '（指引／估計）' : ''}`, rows: d.rows || [['數值', format(d.value)]] });
                  }}
                />
              </g>
            );
          })}
          <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="var(--axis)" strokeWidth="1" />
        </svg>
      )}
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}

// ---------- 折線圖（多系列、同一 y 軸、十字線 hover） ----------

export function LineChart({ labels, series, height = 190, format = (v) => v, domain, estimateFrom, ariaLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const m = { l: 40, r: 64, t: 14, b: 28 };
  const iw = Math.max(width - m.l - m.r, 10);
  const ih = height - m.t - m.b;
  const all = series.flatMap((s) => s.values.filter((v) => v != null));
  const [lo, hi] = domain || [Math.min(...all), Math.max(...all)];
  const ticks = niceTicks(lo, hi, 4);
  const yMin = Math.min(lo, ticks[0]);
  const yMax = Math.max(hi, ticks[ticks.length - 1]);
  const x = (i) => m.l + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;

  const segPath = (vals, from, to) => {
    let d = '';
    for (let i = from; i <= to; i++) if (vals[i] != null) d += `${d ? 'L' : 'M'}${x(i)},${y(vals[i])}`;
    return d;
  };
  const lastIdx = labels.length - 1;
  const solidEnd = estimateFrom != null ? estimateFrom - 1 : lastIdx;

  const endLabels = spread(series.map((s) => ({ key: s.key, pos: y(s.values[lastIdx] ?? s.values[solidEnd]) })), 14, m.t, m.t + ih);

  return (
    <div ref={ref} className="relative w-full">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - box.left;
            const i = Math.round(((px - m.l) / iw) * (labels.length - 1));
            if (i >= 0 && i <= lastIdx) setHover({ i, x: px, y: e.clientY - box.top });
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize="10" fill="var(--ink-3)">{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (
            <text key={l} x={x(i)} y={height - 9} textAnchor="middle" fontSize="10.5" fill={estimateFrom != null && i >= estimateFrom ? 'var(--ink-3)' : 'var(--ink-2)'}>{l}</text>
          ))}
          {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={m.t} y2={m.t + ih} stroke="var(--axis)" strokeWidth="1" />}
          {series.map((s) => (
            <g key={s.key}>
              <path d={segPath(s.values, 0, solidEnd)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {estimateFrom != null && (
                <path d={segPath(s.values, solidEnd, lastIdx)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
              )}
              {s.values.map((v, i) =>
                v == null ? null : (
                  <circle key={i} cx={x(i)} cy={y(v)} r={hover?.i === i || i === lastIdx ? 4.5 : 3} fill={s.color} stroke="var(--surface)" strokeWidth="2" />
                ),
              )}
            </g>
          ))}
          {endLabels.map((el) => {
            const s = series.find((ss) => ss.key === el.key);
            const v = s.values[lastIdx] ?? s.values[solidEnd];
            return (
              <text key={el.key} x={m.l + iw + 10} y={el.pos} dy="0.32em" fontSize="10.5" className="num" fill="var(--ink)">
                {format(v)}
              </text>
            );
          })}
        </svg>
      )}
      <ChartTooltip
        tip={hover && { x: hover.x, y: hover.y, title: labels[hover.i], rows: series.map((s) => [s.name, s.values[hover.i] == null ? '—' : format(s.values[hover.i]), s.color]) }}
        width={width}
      />
    </div>
  );
}

// ---------- 100% 堆疊橫條（2px 表面間隙） ----------

export function StackedBar({ segments, format = (v) => v, height = 22, ariaLabel }) {
  const [tip, setTip] = useState(null);
  const [ref, width] = useWidth();
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex w-full gap-[2px]" style={{ height }} role="img" aria-label={ariaLabel}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            className={cx('h-full first:rounded-l last:rounded-r transition-opacity', tip && tip.i !== i && 'opacity-60')}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: s.value > 0 ? 3 : 0 }}
            onMouseMove={(e) => {
              const box = ref.current.getBoundingClientRect();
              setTip({ i, x: e.clientX - box.left, y: e.clientY - box.top + 16, title: s.label, rows: [['數值', format(s.value)], ['佔比', `${((s.value / total) * 100).toFixed(1)}%`]] });
            }}
          />
        ))}
      </div>
      <ChartTooltip tip={tip} width={width} />
    </div>
  );
}

// ---------- 儀表條 ----------

export function Meter({ value, max = 100, label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = pct >= 60 ? 'var(--up)' : pct <= 40 ? 'var(--down)' : 'var(--warn)';
  return (
    <div className="w-full" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="relative h-2 w-full rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
        {[40, 60].map((t) => (
          <div key={t} className="absolute inset-y-0 w-[2px] bg-surface" style={{ left: `${t}%` }} aria-hidden />
        ))}
      </div>
    </div>
  );
}

// ---------- 52 週區間位置條 ----------

export function RangeBar({ low, high, price, compact }) {
  const pos = high > low ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100)) : 50;
  return (
    <div className="w-full">
      <div className="relative h-1.5 rounded-full bg-surface-3">
        <div className="absolute inset-y-0 left-0 rounded-full bg-s1/50" style={{ width: `${pos}%` }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-s1" style={{ left: `${pos}%` }} title={`52 週位置 ${pos.toFixed(0)}%`} />
      </div>
      {!compact && (
        <div className="num mt-1.5 flex justify-between text-[10.5px] text-ink-3">
          <span>{fmtUsd(low)}</span>
          <span className="text-ink-2">52W {pos.toFixed(0)}%</span>
          <span>{fmtUsd(high)}</span>
        </div>
      )}
    </div>
  );
}

// ---------- 目標價刻度：區間帶 + 三情境 + 華爾街 + 現價 ----------

export function TargetScale({ price, scenarios, street, zones, compact = false }) {
  const [ref, width] = useWidth();
  const pts = [price, ...scenarios.map((s) => s.targetPrice), zones.cheap.max, zones.expensive.min];
  if (!compact && street) pts.push(street.lowTarget, street.highTarget);
  const lo = Math.min(...pts) * 0.93;
  const hi = Math.max(...pts) * 1.04;
  const padX = 14;
  const iw = Math.max(width - padX * 2, 10);
  const x = (v) => padX + ((v - lo) / (hi - lo)) * iw;
  const H = compact ? 58 : 118;
  const axisY = compact ? 34 : 60;
  const narrow = width < 560;
  // 依實際標籤長度估算寬度（10.5px 等寬字約 6.4px／字），避免長價格（如 $1,193）互相重疊
  const charW = compact ? 5.9 : 6.4;
  const labelW = (text) => text.length * charW + 10;
  const scenarioLabel = { bear: 'Bear', base: 'Base', bull: 'Bull' };
  const ourText = (s) => `${scenarioLabel[s.key]} ${fmtUsd(s.targetPrice, 0)}`;
  const streetPrefix = narrow ? '' : 'Street ';
  const streetName = { low: 'Low', median: narrow ? 'Med' : 'Median', high: 'High' };
  const streetText = (p) => `${streetPrefix}${streetName[p.key]} ${fmtUsd(p.v, 0)}`;

  const ourGap = Math.max(...scenarios.map((s) => labelW(ourText(s))));
  const ourHalf = ourGap / 2;
  const ours = spread(scenarios.map((s) => ({ key: s.key, pos: x(s.targetPrice), s })), ourGap, padX + ourHalf - 10, padX + iw - ourHalf + 10);
  const streetRaw = !compact && street
    ? [
        { key: 'low', pos: x(street.lowTarget), v: street.lowTarget },
        { key: 'median', pos: x(street.medianTarget), v: street.medianTarget },
        { key: 'high', pos: x(street.highTarget), v: street.highTarget },
      ]
    : [];
  const streetGap = streetRaw.length ? Math.max(...streetRaw.map((p) => labelW(streetText(p)))) : 0;
  const streetPts = streetRaw.length ? spread(streetRaw, streetGap, padX + streetGap / 2 - 10, padX + iw - streetGap / 2 + 10) : [];
  const scenarioColor = { bear: 'var(--down)', base: 'var(--accent)', bull: 'var(--up)' };
  const bandY = axisY - 5;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="目標價刻度：現價、三情境目標價與華爾街共識">
          {/* 估值區間帶 */}
          <rect x={x(lo)} y={bandY} width={Math.max(x(zones.cheap.max) - x(lo), 0)} height="10" fill="var(--up)" opacity="0.18" rx="2" />
          <rect x={x(zones.fair.low)} y={bandY} width={Math.max(x(zones.fair.high) - x(zones.fair.low), 0)} height="10" fill="var(--neutral-mark)" opacity="0.55" rx="2" />
          <rect x={x(zones.expensive.min)} y={bandY} width={Math.max(x(hi) - x(zones.expensive.min), 0)} height="10" fill="var(--down)" opacity="0.18" rx="2" />
          <line x1={padX} x2={padX + iw} y1={axisY} y2={axisY} stroke="var(--axis)" strokeWidth="1" />

          {/* 我方三情境（軸上方） */}
          {ours.map((o) => (
            <g key={o.key}>
              <line x1={x(o.s.targetPrice)} x2={x(o.s.targetPrice)} y1={bandY - 6} y2={axisY + 5} stroke={scenarioColor[o.key]} strokeWidth="2" strokeLinecap="round" />
              <line x1={x(o.s.targetPrice)} x2={o.pos} y1={bandY - 6} y2={bandY - 10} stroke="var(--axis)" strokeWidth="1" />
              <text x={o.pos} y={bandY - 14} textAnchor="middle" fontSize={compact ? 9.5 : 10.5} fill="var(--ink)" className="num">
                <tspan fill="var(--ink-3)">{scenarioLabel[o.key]} </tspan>
                {fmtUsd(o.s.targetPrice, 0)}
              </text>
            </g>
          ))}

          {/* 華爾街（軸下方） */}
          {streetPts.map((p) => (
            <g key={p.key}>
              <circle cx={x(p.v)} cy={axisY + 14} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
              <line x1={x(p.v)} x2={p.pos} y1={axisY + 18} y2={axisY + 22} stroke="var(--axis)" strokeWidth="1" />
              <text x={p.pos} y={axisY + 32} textAnchor="middle" fontSize="10.5" fill="var(--ink)" className="num">
                <tspan fill="var(--ink-3)">{streetPrefix}{streetName[p.key]} </tspan>
                {fmtUsd(p.v, 0)}
              </text>
            </g>
          ))}

          {/* 現價 */}
          <g>
            <line x1={x(price)} x2={x(price)} y1={bandY - 2} y2={compact ? axisY + 9 : axisY + 46} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            <text x={x(price)} y={compact ? axisY + 21 : axisY + 56} textAnchor={x(price) < 60 ? 'start' : x(price) > width - 60 ? 'end' : 'middle'} fontSize="10.5" fontWeight="600" fill="var(--ink)" className="num">
              現價 {fmtUsd(price)}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}

// ---------- 關鍵價位階梯（垂直價格軸） ----------

export function LevelLadder({ levels, price, markers = [], height = 360, labels }) {
  const [ref, width] = useWidth();
  const all = [price, ...levels.flatMap((l) => [l.price, l.rangeLow, l.rangeHigh].filter(Boolean)), ...markers.map((mk) => mk.price)];
  const lo = Math.min(...all) * 0.95;
  const hi = Math.max(...all) * 1.03;
  const m = { l: 118, r: 118, t: 16, b: 16 };
  const iw = Math.max(width - m.l - m.r, 40);
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (height - m.t - m.b);
  const color = (side) => (side === 'support' ? 'var(--up)' : side === 'resistance' ? 'var(--down)' : 'var(--accent)');
  const left = spread(levels.map((l) => ({ l, pos: y(l.price) })), 34, m.t + 6, height - m.b - 10);
  const right = spread([{ price, label: '現價', strong: true }, ...markers].map((mk) => ({ mk, pos: y(mk.price) })), 15, m.t + 6, height - m.b - 6);

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="關鍵價位階梯">
          <line x1={m.l + iw / 2} x2={m.l + iw / 2} y1={m.t} y2={height - m.b} stroke="var(--grid)" strokeWidth="1" />
          {levels.map((l) => {
            const side = labels[l.type]?.side;
            return (
              <g key={l.type}>
                {l.rangeLow && l.rangeHigh && (
                  <rect x={m.l} width={iw} y={y(l.rangeHigh)} height={Math.max(y(l.rangeLow) - y(l.rangeHigh), 2)} fill={color(side)} opacity="0.12" />
                )}
                <line x1={m.l} x2={m.l + iw} y1={y(l.price)} y2={y(l.price)} stroke={color(side)} strokeWidth="2" strokeLinecap="round" />
              </g>
            );
          })}
          {left.map(({ l, pos }) => (
            <g key={l.type}>
              <line x1={m.l - 6} x2={m.l} y1={pos} y2={y(l.price)} stroke="var(--axis)" strokeWidth="1" />
              <text x={m.l - 10} y={pos - 5} textAnchor="end" fontSize="11" fill="var(--ink)">{labels[l.type]?.zh}</text>
              <text x={m.l - 10} y={pos + 9} textAnchor="end" fontSize="10.5" className="num" fill="var(--ink-2)">{fmtUsd(l.price)}</text>
            </g>
          ))}
          <line x1={m.l} x2={m.l + iw} y1={y(price)} y2={y(price)} stroke="var(--ink)" strokeWidth="2" />
          {markers.map((mk) => (
            <circle key={mk.label} cx={m.l + iw} cy={y(mk.price)} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
          ))}
          {right.map(({ mk, pos }) => (
            <g key={mk.label}>
              <line x1={m.l + iw} x2={m.l + iw + 6} y1={y(mk.price)} y2={pos} stroke="var(--axis)" strokeWidth="1" />
              <text x={m.l + iw + 10} y={pos} dy="0.32em" fontSize="10.5" className="num" fill={mk.strong ? 'var(--ink)' : 'var(--ink-2)'} fontWeight={mk.strong ? 700 : 400}>
                {mk.label} {fmtUsd(mk.price)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
