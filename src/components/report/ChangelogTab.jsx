import { ArrowRight, History } from 'lucide-react';
import { Badge, BulletList, Card, CardHeader, RatingBadge, SectionTitle, cx } from '../ui.jsx';
import { Legend, LineChart } from '../charts.jsx';
import { fmtDate, fmtPct, fmtUsd, signClass } from '../../lib/format.js';
import { pctChange } from '../../lib/metrics.js';

export default function ChangelogTab({ a, m }) {
  const log = a.changelog;
  const chrono = [...log].reverse();

  return (
    <div>
      {chrono.length >= 2 && (
        <Card className="mb-4">
          <CardHeader
            title="目標價與股價演進"
            en="Base Target vs. Price at Update"
            right={<Legend items={[{ label: 'Base 目標價', color: 'var(--accent)', line: true }, { label: '更新時股價', color: 'var(--series-1)', line: true }]} />}
          />
          <div className="p-3">
            <LineChart
              ariaLabel="Base 目標價與更新時股價折線圖"
              labels={chrono.map((c) => c.date.slice(2).replace(/-/g, '/'))}
              series={[
                { key: 'base', name: 'Base 目標價', color: 'var(--accent)', values: chrono.map((c) => c.baseTargetTo) },
                { key: 'px', name: '更新時股價', color: 'var(--series-1)', values: chrono.map((c) => c.priceAtUpdate) },
              ]}
              format={(v) => `$${Math.round(v)}`}
            />
          </div>
        </Card>
      )}

      <SectionTitle icon={History} en={`${log.length} 筆紀錄 · 由新到舊`}>歷史觀點演進</SectionTitle>
      <ol className="relative ml-2 border-l border-line">
        {log.map((c, i) => {
          const targetChg = c.baseTargetFrom != null ? pctChange(c.baseTargetTo, c.baseTargetFrom) : null;
          const sinceUpdate = i === 0 ? pctChange(m.price, c.priceAtUpdate) : null;
          return (
            <li key={`${c.date}-${i}`} className="relative pb-6 pl-6 last:pb-0">
              <span className={cx('absolute -left-[6px] top-1.5 h-3 w-3 rounded-full border-2 border-surface', i === 0 ? 'bg-accent' : 'bg-ink-3')} aria-hidden />
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-sm font-semibold text-ink">{fmtDate(c.date)}</span>
                  {i === 0 && <Badge tone="accent">最新</Badge>}
                  {c.baseTargetFrom == null && <Badge tone="info">首次覆蓋</Badge>}
                  <span className="num text-xs text-ink-3">更新時股價 {fmtUsd(c.priceAtUpdate)}</span>
                  {sinceUpdate != null && (
                    <span className="text-xs text-ink-3">
                      · 至今 <span className={cx('num', signClass(sinceUpdate))}>{fmtPct(sinceUpdate)}</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="text-[11px] text-ink-3">評等</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {c.ratingFrom ? <RatingBadge rating={c.ratingFrom} /> : <span className="text-xs text-ink-3">—</span>}
                      <ArrowRight className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                      <RatingBadge rating={c.ratingTo} />
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="text-[11px] text-ink-3">Base 目標價（Old → New）</div>
                    <div className="num mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-ink-2">{c.baseTargetFrom != null ? fmtUsd(c.baseTargetFrom, 0) : '—'}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                      <span className="font-semibold text-ink">{fmtUsd(c.baseTargetTo, 0)}</span>
                      {targetChg != null && <span className={cx('text-xs', signClass(targetChg))}>{fmtPct(targetChg)}</span>}
                      <span className="text-[11px] text-ink-3">（Bear {fmtUsd(c.bearTarget, 0)} / Bull {fmtUsd(c.bullTarget, 0)}）</span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-ink">{c.summary}</p>
                <BulletList items={c.keyChanges} className="mt-2 !text-xs" />
                {c.previousThesis && (
                  <details className="mt-3 rounded-lg border border-line px-3 py-2 text-xs text-ink-2">
                    <summary className="cursor-pointer text-ink-3">更新前的核心觀點</summary>
                    <p className="mt-2 leading-relaxed">{c.previousThesis}</p>
                  </details>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
