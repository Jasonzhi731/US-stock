import { ArrowLeft, Clock } from 'lucide-react';
import { Badge, Delta, RatingBadge, cx } from '../ui.jsx';
import { deriveMetrics } from '../../lib/metrics.js';
import { fmtBigUsd, fmtDate, fmtDateTime, fmtPct, fmtUsd, signClass } from '../../lib/format.js';
import { SCENARIO, ZONE } from '../../lib/labels.js';
import { TABS, stockHref } from '../../lib/router.js';
import FundamentalsTab from './FundamentalsTab.jsx';
import TechnicalsTab from './TechnicalsTab.jsx';
import CatalystsTab from './CatalystsTab.jsx';
import ValuationTab from './ValuationTab.jsx';
import ChangelogTab from './ChangelogTab.jsx';

const SCENARIO_ACCENT = { bear: 'border-t-down', base: 'border-t-accent', bull: 'border-t-up' };

function TargetMatrix({ m, v, dense }) {
  return (
    <div className={cx('grid gap-2', dense ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-3')}>
      {m.scenarios.map((s) => (
        <div key={s.key} className={cx('rounded-lg border border-line border-t-2 bg-surface-2 px-3 py-2', SCENARIO_ACCENT[s.key])}>
          <div className="flex items-center justify-between text-[11px] text-ink-3">
            <span>{SCENARIO[s.key].en} · {SCENARIO[s.key].zh}</span>
            <span className="num">{s.probabilityPct}%</span>
          </div>
          <div className="num mt-0.5 text-lg font-semibold text-ink">{fmtUsd(s.targetPrice, 0)}</div>
          <Delta value={s.liveUpsidePct} className="text-xs" />
        </div>
      ))}
      <div className="rounded-lg border border-line border-t-2 border-t-s1 bg-surface-2 px-3 py-2">
        <div className="text-[11px] text-ink-3">Street Median · {v.streetConsensus.analystCount} 位</div>
        <div className="num mt-0.5 text-lg font-semibold text-ink">{fmtUsd(m.streetMedian, 0)}</div>
        <div className="text-xs text-ink-3">
          預期差 <span className={cx('num', signClass(m.expectationGapPct))}>{fmtPct(m.expectationGapPct)}</span>
        </div>
      </div>
      <div className="rounded-lg border border-line border-t-2 border-t-line-strong bg-surface-2 px-3 py-2">
        <div className="text-[11px] text-ink-3">機率加權目標價</div>
        <div className="num mt-0.5 text-lg font-semibold text-ink">{fmtUsd(m.weightedTarget, 0)}</div>
        <Delta value={m.weightedUpsidePct} className="text-xs" />
      </div>
    </div>
  );
}

export default function StockReport({ stock, tab }) {
  const a = stock.analysis;
  const v = a.valuation;
  const m = deriveMetrics(stock);
  const zoneTone = ZONE[m.zone].tone === 'up' ? 'up' : ZONE[m.zone].tone === 'down' ? 'down' : 'neutral';

  const content = {
    fundamentals: <FundamentalsTab a={a} />,
    technicals: <TechnicalsTab a={a} m={m} />,
    catalysts: <CatalystsTab a={a} />,
    valuation: <ValuationTab a={a} m={m} />,
    changelog: <ChangelogTab a={a} m={m} />,
  }[tab];

  return (
    <div>
      <a href="#/" className="mb-3 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> 返回總覽
      </a>

      {/* 頂部固定：核心報價 + 目標價矩陣 + 分頁 */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/92 px-4 pt-3 backdrop-blur-md">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="num text-2xl font-bold text-ink">{v.ticker}</h1>
              <Badge>{v.exchange}</Badge>
              <RatingBadge rating={v.rating} size="lg" />
              <Badge tone={zoneTone}>{ZONE[m.zone].zh}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-ink-2">{v.nameZh} · {v.name} · {v.industry}</p>
          </div>
          <div className="flex items-end gap-5">
            <div className="text-right">
              <div className="num text-2xl font-semibold text-ink">{fmtUsd(m.price)}</div>
              <div className="flex items-center justify-end gap-2 text-xs">
                {m.isLive ? <Delta value={m.changePct} digits={2} /> : null}
                <span className="text-ink-3" title={m.priceSource}>{m.isLive ? '即時' : `${fmtDate(v.priceDate)} 收盤`}</span>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-[11px] text-ink-3">市值{m.marketCapEstimated ? '（估）' : ''}</div>
              <div className="num text-sm text-ink">{fmtBigUsd(m.marketCap)}</div>
              <div className="num text-[11px] text-ink-3">FY28E P/E {m.forwardPE?.toFixed(1)}x</div>
            </div>
          </div>
        </div>

        <div className="mt-3 hidden lg:block">
          <TargetMatrix m={m} v={v} dense />
        </div>

        <nav className="scrollbar-thin -mx-4 mt-3 flex gap-1 overflow-x-auto px-4" aria-label="報告分頁">
          {TABS.map((t) => (
            <a
              key={t.key}
              href={stockHref(v.ticker, t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={cx(
                'whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                tab === t.key ? 'border-accent font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {t.zh}
              <span className="ml-1.5 hidden text-[10.5px] font-normal text-ink-3 xl:inline">{t.en}</span>
            </a>
          ))}
        </nav>
      </div>

      {/* 小螢幕：目標價矩陣不固定，避免佔滿畫面 */}
      <div className="mt-4 lg:hidden">
        <TargetMatrix m={m} v={v} />
      </div>

      <div className="mt-5">{content}</div>

      <p className="mt-10 flex items-center gap-1.5 text-[11px] text-ink-3">
        <Clock className="h-3 w-3" aria-hidden />
        分析更新：{fmtDateTime(v.updatedAt)} · 資料截至 {fmtDate(a.meta.dataAsOf)} · {a.meta.analyst} · 分析來源 {stock.analysisSource === 'sheets' ? 'Google Sheets' : '本地 /data'}
      </p>
    </div>
  );
}
