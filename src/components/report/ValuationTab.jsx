import { ExternalLink, Info, Scale, Target, Users } from 'lucide-react';
import { Badge, BulletList, Card, CardHeader, Delta, KV, SectionTitle, cx } from '../ui.jsx';
import { Legend, StackedBar, TargetScale } from '../charts.jsx';
import ValuationPlayground from './ValuationPlayground.jsx';
import { fmtDate, fmtNum, fmtPct, fmtUsd, signClass } from '../../lib/format.js';
import { SCENARIO, ZONE } from '../../lib/labels.js';

const SCEN_TONE = { bear: 'down', base: 'accent', bull: 'up' };
const RATING_COLORS = { buy: 'var(--series-1)', hold: 'var(--neutral-mark)', sell: 'var(--down)' };

export default function ValuationTab({ a, m }) {
  const v = a.valuation;
  const sc = v.streetConsensus;
  const z = v.priceZones;
  const total = sc.ratings.buy + sc.ratings.hold + sc.ratings.sell;
  const pct = (n) => (total ? `${((n / total) * 100).toFixed(0)}%` : '—');

  return (
    <div>
      <ValuationPlayground v={v} price={m.price} />

      <SectionTitle icon={Target} en="Scenario Target Matrix">三情境目標價矩陣</SectionTitle>
      <Card className="mb-4 p-4">
        <TargetScale price={m.price} scenarios={m.scenarios} street={sc} zones={z} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Legend
            items={[
              { label: '便宜區', color: 'color-mix(in srgb, var(--up) 35%, transparent)' },
              { label: '合理區', color: 'var(--neutral-mark)' },
              { label: '昂貴區', color: 'color-mix(in srgb, var(--down) 35%, transparent)' },
              { label: '華爾街目標價', color: 'var(--series-1)' },
            ]}
          />
          <span className="text-[11px] text-ink-3">時間框架 {v.timeHorizonMonths} 個月 · {v.fiscalYearNote}</span>
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {m.scenarios.map((s) => (
          <Card key={s.key} className={cx('border-t-2', s.key === 'bear' ? 'border-t-down' : s.key === 'bull' ? 'border-t-up' : 'border-t-accent')}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <Badge tone={SCEN_TONE[s.key]}>{SCENARIO[s.key].en} · {SCENARIO[s.key].zh}</Badge>
                <span className="num text-xs text-ink-3">機率 {s.probabilityPct}%</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <span className="num text-3xl font-semibold text-ink">{fmtUsd(s.targetPrice, 0)}</span>
                <div className="text-right">
                  <Delta value={s.liveUpsidePct} className="text-base font-semibold" />
                  <div className="num text-[10.5px] text-ink-3">分析日 {fmtPct(s.impliedUpsidePct)}</div>
                </div>
              </div>
              <div className="mt-3 rounded-lg bg-surface-2 px-3 py-1">
                <KV k="估值方法" v={s.method} />
                <KV k="基準" v={`${s.basisPeriod} ${s.metricName}`} />
                <KV k="指標值" v={fmtNum(s.metricValue, 2)} />
                <KV k="目標倍數" v={s.targetMultiple != null ? `${fmtNum(s.targetMultiple, 1)}x` : '—'} />
              </div>
              <div className="num mt-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-xs text-ink">{s.formula}</div>
              <p className="mt-3 text-xs leading-relaxed text-ink-2">{s.thesis}</p>
              <div className="mt-3 text-[11px] text-ink-3">關鍵假設</div>
              <BulletList items={s.keyAssumptions} className="mt-1.5 !text-xs" />
              {s.dcf && (
                <div className="mt-3 rounded-lg bg-surface-2 px-3 py-1 text-xs">
                  <KV k="WACC" v={fmtPct(s.dcf.waccPct, 1, { sign: false })} />
                  <KV k="永續成長率" v={fmtPct(s.dcf.terminalGrowthPct, 1, { sign: false })} />
                  <KV k="預測年數" v={s.dcf.forecastYears} />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">評等理由</span>
          <Badge tone="accent">{v.rating}</Badge>
          <span className="text-xs text-ink-3">機率加權目標價 <span className="num text-ink">{fmtUsd(m.weightedTarget)}</span>（<span className={signClass(m.weightedUpsidePct)}>{fmtPct(m.weightedUpsidePct)}</span>）</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.ratingRationale}</p>
      </Card>

      <SectionTitle icon={Users} en="Street Consensus">華爾街共識對照</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title={`${sc.analystCount} 位分析師 · ${sc.consensusRating}`} en={`${sc.source} · ${fmtDate(sc.asOf)}`} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            {[
              ['Low', sc.lowTarget],
              ['Median', sc.medianTarget],
              ['Mean', sc.meanTarget],
              ['High', sc.highTarget],
            ].map(([k, val]) => (
              <div key={k} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                <div className="text-[11px] text-ink-3">{k} Target</div>
                <div className="num text-lg font-semibold text-ink">{fmtUsd(val, 0)}</div>
                <Delta value={val ? ((val - m.price) / m.price) * 100 : null} className="text-[11px]" />
              </div>
            ))}
          </div>
          <div className="border-t border-line p-4">
            <div className="mb-2 text-xs text-ink-3">評等分布</div>
            <StackedBar
              segments={[
                { label: `Buy 買進 ${sc.ratings.buy}`, value: sc.ratings.buy, color: RATING_COLORS.buy },
                { label: `Hold 持有 ${sc.ratings.hold}`, value: sc.ratings.hold, color: RATING_COLORS.hold },
                { label: `Sell 賣出 ${sc.ratings.sell}`, value: sc.ratings.sell, color: RATING_COLORS.sell },
              ]}
              format={(n) => `${n} 位`}
              ariaLabel="分析師評等分布"
            />
            <Legend
              className="mt-2"
              items={[
                { label: `Buy ${sc.ratings.buy}（${pct(sc.ratings.buy)}）`, color: RATING_COLORS.buy },
                { label: `Hold ${sc.ratings.hold}（${pct(sc.ratings.hold)}）`, color: RATING_COLORS.hold },
                { label: `Sell ${sc.ratings.sell}（${pct(sc.ratings.sell)}）`, color: RATING_COLORS.sell },
              ]}
            />
          </div>
          {sc.notes && <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-2">{sc.notes}</p>}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Scale} title="預期差分析" en="Base vs. Street" />
          <div className="space-y-3 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-2">我方 Base</span>
              <span className="num text-lg font-semibold text-ink">{fmtUsd(v.scenarios.base.targetPrice, 0)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-2">華爾街 Median</span>
              <span className="num text-lg font-semibold text-ink">{fmtUsd(sc.medianTarget, 0)}</span>
            </div>
            <div className="rounded-lg bg-surface-2 p-3 text-center">
              <div className="text-[11px] text-ink-3">預期差（Base ÷ Median − 1）</div>
              <div className={cx('num text-3xl font-semibold', signClass(m.expectationGapPct))}>{fmtPct(m.expectationGapPct)}</div>
              <div className="mt-1 text-xs text-ink-2">
                {m.expectationGapPct < -15 ? '顯著低於共識：我方看法較保守，或共識尚未反映最新風險' : m.expectationGapPct > 15 ? '顯著高於共識：存在市場尚未定價的上行空間' : '與共識接近'}
              </div>
            </div>
            <KV k="Base 是否低於 Street Low" v={v.scenarios.base.targetPrice < sc.lowTarget ? '是' : '否'} />
            <KV k="Street 買進比例" v={fmtPct(m.buyPct, 0, { sign: false })} />
            <KV k="Street Median 隱含空間" v={<span className={signClass(m.streetUpsidePct)}>{fmtPct(m.streetUpsidePct)}</span>} />
          </div>
        </Card>
      </div>

      <SectionTitle icon={Target} en="Price Zones">合理價區間</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['cheap', `≤ ${fmtUsd(z.cheap.max, 0)}`, z.cheap.multiple != null ? `≤ ${z.cheap.multiple}x` : null, 'up'],
          ['fair', `${fmtUsd(z.fair.low, 0)} – ${fmtUsd(z.fair.high, 0)}`, z.fair.multipleLow != null ? `${z.fair.multipleLow}x – ${z.fair.multipleHigh}x` : null, 'neutral'],
          ['expensive', `≥ ${fmtUsd(z.expensive.min, 0)}`, z.expensive.multiple != null ? `≥ ${z.expensive.multiple}x` : null, 'down'],
        ].map(([key, range, mult, tone]) => (
          <Card key={key} className={cx('p-4', m.zone === key && 'ring-2 ring-accent')}>
            <div className="flex items-center justify-between">
              <Badge tone={tone}>{ZONE[key].zh}</Badge>
              {m.zone === key && <span className="text-[11px] font-medium text-accent">現價所在</span>}
              {key === 'cheap' && m.zone === 'below-fair' && <span className="text-[11px] text-ink-3">現價介於便宜與合理之間</span>}
              {key === 'expensive' && m.zone === 'above-fair' && <span className="text-[11px] text-ink-3">現價介於合理與昂貴之間</span>}
            </div>
            <div className="num mt-2 text-xl font-semibold text-ink">{range}</div>
            {mult && <div className="num text-xs text-ink-3">{z.basis.split('（')[0]} × {mult}</div>}
          </Card>
        ))}
      </div>
      <Card className="mt-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-2">現價 {fmtUsd(m.price)} 位於</span>
          <Badge tone={ZONE[m.zone].tone === 'up' ? 'up' : ZONE[m.zone].tone === 'down' ? 'down' : 'neutral'}>{ZONE[m.zone].zh}</Badge>
          <span className="text-ink-3">· 隱含 P/E {m.forwardPE?.toFixed(1)}x（{z.basis}）</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">{z.methodology}</p>
      </Card>

      <SectionTitle icon={Info} en="Sources & Disclosures">資料來源與揭露</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <ol className="space-y-1.5 text-xs">
            {a.meta.sources.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="num shrink-0 text-ink-3">[{s.id}]</span>
                <a href={s.url} target="_blank" rel="noreferrer noopener" className="text-ink-2 hover:text-accent">
                  {s.title} <span className="text-ink-3">— {s.publisher}{s.date ? `, ${fmtDate(s.date)}` : ''}</span>
                  <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
                </a>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-4">
          <div className="mb-2 text-xs font-medium text-ink">資料品質與估算揭露</div>
          <BulletList items={a.meta.dataQualityNotes} className="!text-xs" />
        </Card>
      </div>
    </div>
  );
}
