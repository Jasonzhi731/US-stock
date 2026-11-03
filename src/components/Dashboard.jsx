import { useMemo, useState } from 'react';
import { ArrowUpDown, Building2, ChevronRight, LayoutGrid, Search, Table2, Target, Users } from 'lucide-react';
import { Badge, Card, Delta, RatingBadge, Stat, cx } from './ui.jsx';
import { RangeBar, TargetScale } from './charts.jsx';
import { deriveMetrics } from '../lib/metrics.js';
import { fmtBigUsd, fmtDate, fmtPct, fmtUsd, signClass } from '../lib/format.js';
import { RATING_ORDER, ZONE } from '../lib/labels.js';
import { stockHref } from '../lib/router.js';

const SORTS = {
  upside: { zh: 'Base 潛在空間', fn: (a, b) => b.m.base.liveUpsidePct - a.m.base.liveUpsidePct },
  gap: { zh: '與華爾街預期差', fn: (a, b) => b.m.expectationGapPct - a.m.expectationGapPct },
  change: { zh: '當日漲跌', fn: (a, b) => (b.m.changePct ?? -1e9) - (a.m.changePct ?? -1e9) },
  pos52: { zh: '52 週位置', fn: (a, b) => (a.m.pos52 ?? 0) - (b.m.pos52 ?? 0) },
  ticker: { zh: '代號', fn: (a, b) => a.ticker.localeCompare(b.ticker) },
  updated: { zh: '最近更新', fn: (a, b) => Date.parse(b.v.updatedAt) - Date.parse(a.v.updatedAt) },
};

function zoneTone(z) {
  return ZONE[z]?.tone === 'up' ? 'up' : ZONE[z]?.tone === 'down' ? 'down' : 'neutral';
}

export default function Dashboard({ stocks }) {
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState('All');
  const [sector, setSector] = useState('All');
  const [sort, setSort] = useState('upside');
  const [view, setView] = useState('cards');

  const rows = useMemo(() => stocks.map((s) => ({ ticker: s.ticker, s, v: s.analysis.valuation, m: deriveMetrics(s) })), [stocks]);
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.v.sector))].sort(), [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => rating === 'All' || r.v.rating === rating)
      .filter((r) => sector === 'All' || r.v.sector === sector)
      .filter((r) => !q || [r.ticker, r.v.name, r.v.nameZh, r.v.industry].some((t) => t.toLowerCase().includes(q)))
      .sort(SORTS[sort].fn);
  }, [rows, query, rating, sector, sort]);

  const avgUpside = rows.length ? rows.reduce((a, r) => a + r.m.base.liveUpsidePct, 0) / rows.length : null;
  const ratingCount = RATING_ORDER.map((k) => [k, rows.filter((r) => r.v.rating === k).length]);
  const liveCount = rows.filter((r) => r.m.isLive).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">美股總覽儀表板</h1>
        <p className="mt-1 text-sm text-ink-3">Portfolio &amp; Watchlist · 三情境目標價、華爾街共識預期差與即時潛在空間</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="追蹤檔數" value={rows.length} sub={`${liveCount} 檔使用即時報價`} />
        <Stat label="平均 Base 潛在空間" value={<span className={signClass(avgUpside)}>{fmtPct(avgUpside)}</span>} sub="以即時價重算" />
        <Stat label="評等分布" value={ratingCount.filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'} sub="Strong Buy / Buy / Hold / Trim" />
        <Stat label="最近更新" value={rows.length ? fmtDate(rows.map((r) => r.v.updatedAt).sort().at(-1).slice(0, 10)) : '—'} sub="分析 updatedAt" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">搜尋代號或名稱</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋代號、公司或產業（如 MRVL、半導體）"
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="評等篩選">
          {['All', ...RATING_ORDER].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setRating(k)}
              className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', rating === k ? 'bg-accent-soft text-accent ring-1 ring-accent/40' : 'text-ink-2 hover:bg-surface-2')}
              aria-pressed={rating === k}
            >
              {k === 'All' ? '全部評等' : k}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-2 text-xs text-ink focus:border-accent focus:outline-none" aria-label="產業篩選">
            <option value="All">全部產業</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-w-0 rounded-lg border border-line bg-surface-2 px-2 py-2 text-xs text-ink focus:border-accent focus:outline-none" aria-label="排序">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>排序：{s.zh}</option>)}
          </select>
          <div className="flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="檢視方式">
            {[['cards', LayoutGrid, '卡片'], ['table', Table2, '比較表']].map(([k, Icon, label]) => (
              <button key={k} type="button" onClick={() => setView(k)} className={cx('rounded-md p-1.5', view === k ? 'bg-surface text-accent shadow-sm' : 'text-ink-3 hover:text-ink')} aria-pressed={view === k} aria-label={label} title={label}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 && <p className="py-12 text-center text-sm text-ink-3">沒有符合條件的股票。</p>}

      {view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => <StockCard key={r.ticker} r={r} />)}
        </div>
      ) : (
        filtered.length > 0 && <CompareTable rows={filtered} sort={sort} onSort={setSort} />
      )}
    </div>
  );
}

function StockCard({ r }) {
  const { v, m } = r;
  return (
    <a href={stockHref(r.ticker)} className="group block rounded-xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="num text-lg font-bold text-ink">{v.ticker}</span>
            <span className="num text-[10.5px] text-ink-3">{v.exchange}</span>
          </div>
          <div className="truncate text-xs text-ink-2">{v.nameZh} · {v.name}</div>
        </div>
        <RatingBadge rating={v.rating} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="num text-2xl font-semibold text-ink">{fmtUsd(m.price)}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs">
            {m.isLive ? <Delta value={m.changePct} digits={2} /> : <span className="text-ink-3">{fmtDate(v.priceDate)} 收盤</span>}
            <span className="text-ink-3">市值 {fmtBigUsd(m.marketCap)}{m.marketCapEstimated ? '（估）' : ''}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-3">Base 潛在空間</div>
          <Delta value={m.base.liveUpsidePct} className="text-lg font-semibold" />
        </div>
      </div>

      <div className="mt-3">
        <TargetScale price={m.price} scenarios={m.scenarios} zones={v.priceZones} compact />
      </div>

      <div className="mt-2">
        <RangeBar low={m.low52} high={m.high52} price={m.price} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <div className="text-ink-3">Street Median</div>
          <div className="num text-ink">{fmtUsd(m.streetMedian, 0)}</div>
        </div>
        <div>
          <div className="text-ink-3">預期差 vs Street</div>
          <div className={cx('num', signClass(m.expectationGapPct))}>{fmtPct(m.expectationGapPct)}</div>
        </div>
        <div className="text-right">
          <div className="text-ink-3">估值區間</div>
          <Badge tone={zoneTone(m.zone)}>{ZONE[m.zone].zh}</Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-3">
        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden />{v.industry}</span>
        <span className="flex items-center gap-1 text-ink-2 group-hover:text-accent">
          深度報告 <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}

function CompareTable({ rows, sort, onSort }) {
  const head = [
    ['ticker', '代號'], [null, '公司／產業'], [null, '評等'], [null, '股價'], ['change', '漲跌'], [null, '市值'],
    ['pos52', '52 週位置'], [null, 'Bear'], [null, 'Base'], [null, 'Bull'], ['upside', 'Base 空間'],
    [null, 'Street Median'], ['gap', '預期差'], [null, '區間'], ['updated', '更新'],
  ];
  return (
    <Card className="overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-left text-[11px] text-ink-3">
              {head.map(([key, label]) => (
                <th key={label} className="whitespace-nowrap px-3 py-2 font-medium">
                  {key ? (
                    <button type="button" onClick={() => onSort(key)} className={cx('inline-flex items-center gap-1 hover:text-ink', sort === key && 'text-accent')}>
                      {label}
                      <ArrowUpDown className="h-3 w-3" aria-hidden />
                    </button>
                  ) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ticker, v, m }) => (
              <tr key={ticker} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2.5"><a href={stockHref(ticker)} className="num font-bold text-ink hover:text-accent">{ticker}</a></td>
                <td className="px-3 py-2.5"><div className="text-ink">{v.nameZh}</div><div className="text-[11px] text-ink-3">{v.industry}</div></td>
                <td className="px-3 py-2.5"><RatingBadge rating={v.rating} /></td>
                <td className="num px-3 py-2.5 text-ink">{fmtUsd(m.price)}</td>
                <td className="px-3 py-2.5">{m.isLive ? <Delta value={m.changePct} digits={2} /> : <span className="text-ink-3">—</span>}</td>
                <td className="num px-3 py-2.5 text-ink-2">{fmtBigUsd(m.marketCap)}</td>
                <td className="w-32 px-3 py-2.5"><RangeBar low={m.low52} high={m.high52} price={m.price} compact /><div className="num mt-1 text-[10.5px] text-ink-3">{m.pos52?.toFixed(0)}%</div></td>
                <td className="num px-3 py-2.5 text-ink-2">{fmtUsd(v.scenarios.bear.targetPrice, 0)}</td>
                <td className="num px-3 py-2.5 font-semibold text-ink">{fmtUsd(v.scenarios.base.targetPrice, 0)}</td>
                <td className="num px-3 py-2.5 text-ink-2">{fmtUsd(v.scenarios.bull.targetPrice, 0)}</td>
                <td className="px-3 py-2.5"><Delta value={m.base.liveUpsidePct} /></td>
                <td className="num px-3 py-2.5 text-ink-2">{fmtUsd(m.streetMedian, 0)}</td>
                <td className={cx('num px-3 py-2.5', signClass(m.expectationGapPct))}>{fmtPct(m.expectationGapPct)}</td>
                <td className="px-3 py-2.5"><Badge tone={zoneTone(m.zone)}>{ZONE[m.zone].zh}</Badge></td>
                <td className="num whitespace-nowrap px-3 py-2.5 text-[11px] text-ink-3">{fmtDate(v.updatedAt.slice(0, 10))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-ink-3">
        <span className="flex items-center gap-1"><Target className="h-3 w-3" aria-hidden />Base 空間＝（Base 目標價 − 即時股價）÷ 即時股價</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" aria-hidden />預期差＝我方 Base ÷ 華爾街中位數 − 1</span>
      </div>
    </Card>
  );
}
