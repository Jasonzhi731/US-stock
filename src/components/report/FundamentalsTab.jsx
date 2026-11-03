import { Building2, ChartColumn, Landmark, Layers, ShieldCheck, Sparkles, TriangleAlert, Wallet } from 'lucide-react';
import { Badge, BulletList, Card, CardHeader, KV, LevelBadge, SectionTitle, Stat, cx } from '../ui.jsx';
import { ColumnChart, Legend, LineChart, StackedBar } from '../charts.jsx';
import { fmtNum, fmtPct, fmtUsd, fmtUsdM, fmtDate, signClass } from '../../lib/format.js';
import { BEAT_MISS, MOAT_RATING, MOAT_TYPE, MOMENTUM, OUTLOOK_CHANGE, VS_CONSENSUS } from '../../lib/labels.js';

const SEGMENT_COLORS = ['var(--series-1)', 'var(--series-2)', '#1baf7a', '#eda100'];
const MOMENTUM_TONE = { Accelerating: 'up', Growing: 'info', Stable: 'neutral', Declining: 'down' };
const CHANGE_TONE = { Raised: 'up', Maintained: 'neutral', Lowered: 'down', Initiated: 'info' };
const RESULT_TONE = { Beat: 'up', Miss: 'down', InLine: 'neutral' };

function surprise(actual, consensus) {
  if (consensus == null || !consensus) return null;
  return ((actual - consensus) / Math.abs(consensus)) * 100;
}

export default function FundamentalsTab({ a }) {
  const f = a.fundamentals;
  const mb = f.moatAndBusinessModel;
  const eg = f.earningsAndGuidance;
  const fm = f.financialMetrics;
  const lq = eg.latestQuarter;
  const g = eg.guidance;
  const q = fm.quarterly;
  const estimateFrom = q.findIndex((r) => r.isEstimate);

  return (
    <div>
      <SectionTitle icon={ShieldCheck} en="Moat & Business Model">護城河與商業模式</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader icon={Building2} title="商業模式" right={<Badge tone="accent">{MOAT_RATING[mb.moatRating]}</Badge>} />
          <div className="space-y-4 p-4">
            <p className="text-sm leading-relaxed text-ink-2">{mb.businessSummary}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {mb.moatSources.map((s) => (
                <div key={s.title} className="rounded-lg border border-line bg-surface-2 p-3">
                  <Badge tone="info">{MOAT_TYPE[s.type]}</Badge>
                  <div className="mt-2 text-sm font-medium text-ink">{s.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-2">{s.description}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed text-ink-2">
              <span className="font-medium text-ink">競爭地位　</span>
              {mb.competitivePosition}
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader icon={Layers} title="部門營收佔比" en={mb.segmentMix.period} />
          <div className="space-y-4 p-4">
            <StackedBar
              segments={mb.segmentMix.segments.map((s, i) => ({ label: s.name, value: s.revenueUSDm, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))}
              format={(v) => fmtUsdM(v)}
              ariaLabel="部門營收佔比"
            />
            <Legend items={mb.segmentMix.segments.map((s, i) => ({ label: `${s.name} ${s.sharePct}%`, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }))} />
            <div className="divide-y divide-line">
              {mb.segmentMix.segments.map((s) => (
                <div key={s.name} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-ink">{s.name}</span>
                    <span className="num text-ink">{fmtUsdM(s.revenueUSDm)}</span>
                  </div>
                  <div className="num mt-0.5 flex gap-3 text-[11px]">
                    <span className={signClass(s.yoyPct)}>YoY {fmtPct(s.yoyPct)}</span>
                    <span className={signClass(s.qoqPct)}>QoQ {fmtPct(s.qoqPct)}</span>
                  </div>
                  {s.commentary && <p className="mt-1 text-xs text-ink-3">{s.commentary}</p>}
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1.5 text-xs text-ink-3">主要競爭者</div>
              <div className="space-y-1.5">
                {mb.keyCompetitors.map((c) => (
                  <div key={c.name} className="text-xs leading-relaxed text-ink-2">
                    <span className="font-medium text-ink">{c.name}</span>
                    {c.ticker && <span className="num ml-1 text-ink-3">{c.ticker}</span>}
                    <span className="text-ink-3"> — </span>
                    {c.overlap}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mb.productLines.map((p) => (
          <div key={p.name} className="rounded-xl border border-line bg-surface p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-ink">{p.name}</div>
              <Badge tone={MOMENTUM_TONE[p.momentum]}>{MOMENTUM[p.momentum]}</Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-ink-3">{p.segment}</div>
            <p className="mt-2 text-xs leading-relaxed text-ink-2">{p.description}</p>
          </div>
        ))}
      </div>

      <SectionTitle icon={ChartColumn} en="Earnings & Forward Guidance">最新財報與財測指引</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`${lq.fiscalPeriod} 財報表現`} en={`公布 ${fmtDate(lq.reportDate)}`} right={lq.stockReactionPct != null && <span className="text-xs text-ink-3">次日股價 <span className={cx('num', signClass(lq.stockReactionPct))}>{fmtPct(lq.stockReactionPct)}</span></span>} />
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              ['Revenue', fmtUsdM(lq.revenue.actualUSDm, { compact: true }), lq.revenue.consensusUSDm && fmtUsdM(lq.revenue.consensusUSDm, { compact: true }), lq.revenue.result, surprise(lq.revenue.actualUSDm, lq.revenue.consensusUSDm), `YoY ${fmtPct(lq.revenue.yoyPct)} · QoQ ${fmtPct(lq.revenue.qoqPct)}`],
              ['Non-GAAP EPS', fmtUsd(lq.nonGaapEps.actual), lq.nonGaapEps.consensus != null && fmtUsd(lq.nonGaapEps.consensus), lq.nonGaapEps.result, surprise(lq.nonGaapEps.actual, lq.nonGaapEps.consensus), `YoY ${fmtPct(lq.nonGaapEps.yoyPct)}`],
            ].map(([label, actual, cons, result, sp, sub]) => (
              <div key={label} className="rounded-lg border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-3">{label}</span>
                  <Badge tone={RESULT_TONE[result]}>{BEAT_MISS[result]}</Badge>
                </div>
                <div className="num mt-1 text-xl font-semibold text-ink">{actual}</div>
                <div className="num mt-0.5 text-[11px] text-ink-3">
                  共識 {cons || '—'}{sp != null && <span className={cx('ml-1', signClass(sp))}>（{fmtPct(sp)}）</span>}
                </div>
                <div className="num mt-0.5 text-[11px] text-ink-2">{sub}</div>
              </div>
            ))}
            <Stat label="Non-GAAP Gross Margin" value={fmtPct(lq.grossMarginNonGaapPct, 1, { sign: false })} />
            <Stat label="Non-GAAP Operating Margin" value={fmtPct(lq.operatingMarginNonGaapPct, 1, { sign: false })} />
          </div>
          <div className="border-t border-line p-4">
            <BulletList items={lq.highlights} />
          </div>
        </Card>

        <Card>
          <CardHeader title={`${g.period} Forward Guidance`} right={<Badge tone={g.vsConsensus === 'Above' ? 'up' : g.vsConsensus === 'Below' ? 'down' : 'neutral'}>{VS_CONSENSUS[g.vsConsensus]}</Badge>} />
          <div className="grid grid-cols-2 gap-3 p-4">
            <Stat label="Revenue 指引" value={fmtUsdM(g.revenue.midUSDm, { compact: true })} sub={`${fmtUsdM(g.revenue.lowUSDm, { compact: true })} – ${fmtUsdM(g.revenue.highUSDm, { compact: true })} · YoY ${fmtPct(g.revenue.yoyPct)}`} />
            <Stat label="Non-GAAP EPS 指引" value={fmtUsd(g.nonGaapEps.mid)} sub={`${fmtUsd(g.nonGaapEps.low)} – ${fmtUsd(g.nonGaapEps.high)}`} />
            <Stat label="Non-GAAP GM 指引" value={g.grossMarginNonGaapPct ? `${g.grossMarginNonGaapPct.low}–${g.grossMarginNonGaapPct.high}%` : '—'} />
            <Stat label="Non-GAAP OpEx" value={g.opexNonGaapUSDm != null ? fmtUsdM(g.opexNonGaapUSDm) : '—'} sub={g.revenue.consensusBeforeUSDm ? `指引前共識 ${fmtUsdM(g.revenue.consensusBeforeUSDm, { compact: true })}` : undefined} />
          </div>
          <p className="border-t border-line px-4 py-3 text-sm leading-relaxed text-ink-2">{g.commentary}</p>
          <div className="border-t border-line">
            <div className="px-4 pt-3 text-xs text-ink-3">全年／長期展望</div>
            <div className="scrollbar-thin overflow-x-auto px-4 pb-3">
              <table className="mt-2 w-full min-w-[460px] text-xs">
                <tbody>
                  {eg.fullYearOutlook.map((o, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="num whitespace-nowrap py-2 pr-3 text-ink-3">{o.period}</td>
                      <td className="py-2 pr-3 text-ink-2">{o.metric}</td>
                      <td className="py-2 pr-3 font-medium text-ink">{o.value}</td>
                      <td className="py-2 pr-3"><Badge tone={CHANGE_TONE[o.change]}>{OUTLOOK_CHANGE[o.change]}</Badge></td>
                      <td className="py-2 text-ink-3">{o.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader icon={Sparkles} title="Earnings Call 重點摘要" />
        <div className="p-4">
          <BulletList items={eg.earningsCallTakeaways} />
        </div>
      </Card>

      <SectionTitle icon={Wallet} en="Financial Metrics">關鍵財務趨勢</SectionTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`TTM Revenue（${fm.ttm.period}）`} value={fmtUsdM(fm.ttm.revenue, { compact: true })} sub={`YoY ${fmtPct(fm.ttm.revenueYoYPct)}`} />
        <Stat label="TTM FCF / FCF Margin" value={fmtUsdM(fm.ttm.fcf, { compact: true })} sub={`FCF Margin ${fmtPct(fm.ttm.fcfMarginPct, 1, { sign: false })}`} />
        <Stat label="SBC 佔營收（TTM）" value={fmtPct(fm.ttm.sbcPctOfRevenue, 1, { sign: false })} sub={`TTM 回購 ${fmtUsdM(fm.ttm.buybacks, { compact: true })}`} />
        <Stat label={fm.ruleOf40.applicable ? 'Rule of 40' : 'Rule of 40（不適用）'} value={fm.ruleOf40.score != null ? fmtNum(fm.ruleOf40.score, 1) : '—'} sub={fm.ruleOf40.basis} />
        <Stat label="ROIC" value={fmtPct(fm.returns.roicPct, 1, { sign: false })} sub="non-GAAP 估算，含商譽" />
        <Stat label="ROE" value={fmtPct(fm.returns.roePct, 1, { sign: false })} sub="non-GAAP 淨利 ÷ 權益" />
        <Stat label="淨現金（負值＝淨負債）" value={fmtUsdM(fm.balanceSheet.netCashUSDm, { compact: true })} sub={`現金 ${fmtUsdM(fm.balanceSheet.cashUSDm, { compact: true })} / 負債 ${fmtUsdM(fm.balanceSheet.totalDebtUSDm, { compact: true })}`} />
        <Stat label="年化股利／股" value={fm.capitalReturn.dividendPerShareAnnual != null ? fmtUsd(fm.capitalReturn.dividendPerShareAnnual) : '—'} sub={fm.capitalReturn.buybackAuthorizationRemainingUSDm != null ? `剩餘回購額度 ${fmtUsdM(fm.capitalReturn.buybackAuthorizationRemainingUSDm, { compact: true })}` : '剩餘回購額度未揭露'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="季營收" en="Revenue (USD M)" right={<span className="text-[11px] text-ink-3">斜線＝公司指引</span>} />
          <div className="p-3">
            <ColumnChart
              ariaLabel="季營收直條圖"
              data={q.map((r) => ({
                label: r.period,
                value: r.revenue,
                estimate: r.isEstimate,
                rows: [['Revenue', fmtUsdM(r.revenue)], ['YoY', fmtPct(r.revenueYoYPct)], ['Non-GAAP EPS', r.nonGaapEps != null ? fmtUsd(r.nonGaapEps) : '—']],
              }))}
              format={(v, axis) => (axis ? `${(v / 1000).toFixed(1)}B` : `$${(v / 1000).toFixed(2)}B`)}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Non-GAAP 利潤率" en="Gross vs Operating Margin" right={<Legend items={[{ label: 'Gross Margin', color: 'var(--series-1)', line: true }, { label: 'Operating Margin', color: 'var(--series-2)', line: true }]} />} />
          <div className="p-3">
            <LineChart
              ariaLabel="毛利率與營業利益率折線圖"
              labels={q.map((r) => r.period)}
              estimateFrom={estimateFrom >= 0 ? estimateFrom : undefined}
              series={[
                { key: 'gm', name: 'Gross Margin', color: 'var(--series-1)', values: q.map((r) => r.grossMarginNonGaapPct) },
                { key: 'om', name: 'Operating Margin', color: 'var(--series-2)', values: q.map((r) => r.operatingMarginNonGaapPct) },
              ]}
              domain={[30, 62]}
              format={(v) => `${Number(v).toFixed(1)}%`}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4 overflow-hidden">
        <CardHeader icon={Landmark} title="季度財務明細" en={`單位 ${fm.unit}`} />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-ink-3">
                {['期間', 'Revenue', 'YoY', 'GM', 'OPM', 'Non-GAAP EPS', 'OCF', 'CapEx', 'FCF', 'FCF Margin', 'SBC', 'SBC/Rev', 'Buybacks'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.map((r) => (
                <tr key={r.period} className={cx('border-b border-line last:border-0', r.isEstimate && 'text-ink-3')}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{r.period}{r.isEstimate && <span className="ml-1 text-[10px] text-ink-3">指引</span>}</td>
                  <td className="num px-3 py-2">{fmtNum(r.revenue, 1)}</td>
                  <td className={cx('num px-3 py-2', signClass(r.revenueYoYPct))}>{fmtPct(r.revenueYoYPct)}</td>
                  <td className="num px-3 py-2">{fmtPct(r.grossMarginNonGaapPct, 1, { sign: false })}</td>
                  <td className="num px-3 py-2">{fmtPct(r.operatingMarginNonGaapPct, 1, { sign: false })}</td>
                  <td className="num px-3 py-2">{r.nonGaapEps != null ? fmtUsd(r.nonGaapEps) : '—'}</td>
                  <td className="num px-3 py-2">{fmtNum(r.operatingCashFlow, 1)}</td>
                  <td className="num px-3 py-2">{fmtNum(r.capex, 1)}</td>
                  <td className="num px-3 py-2">{fmtNum(r.fcf, 1)}</td>
                  <td className="num px-3 py-2">{fmtPct(r.fcfMarginPct, 1, { sign: false })}</td>
                  <td className="num px-3 py-2">{fmtNum(r.sbc, 1)}</td>
                  <td className="num px-3 py-2">{fmtPct(r.sbcPctOfRevenue, 1, { sign: false })}</td>
                  <td className="num px-3 py-2">{fmtNum(r.buybacks, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-4 border-t border-line p-4 text-sm md:grid-cols-3">
          <div className="md:col-span-2">
            <p className="leading-relaxed text-ink-2">{fm.commentary}</p>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">ROIC／ROE 口徑：{fm.returns.basis}</p>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-1">
            <KV k="資產負債表日" v={fmtDate(fm.balanceSheet.asOf)} />
            <KV k="現金" v={fmtUsdM(fm.balanceSheet.cashUSDm)} />
            <KV k="總負債" v={fmtUsdM(fm.balanceSheet.totalDebtUSDm)} />
            <p className="pb-2 text-[11px] leading-relaxed text-ink-3">{fm.balanceSheet.notes}</p>
            <p className="border-t border-line py-2 text-[11px] leading-relaxed text-ink-3">{fm.capitalReturn.notes}</p>
          </div>
        </div>
      </Card>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle icon={Sparkles} en="Growth Drivers">核心成長引擎</SectionTitle>
          <div className="space-y-3">
            {f.growthDrivers.map((d) => (
              <Card key={d.title} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium text-ink">{d.title}</div>
                  <LevelBadge level={d.magnitude} prefix="影響 " />
                </div>
                <div className="mt-0.5 text-[11px] text-ink-3">{d.timeframe}</div>
                <p className="mt-2 text-xs leading-relaxed text-ink-2">{d.description}</p>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle icon={TriangleAlert} en="SEC & Competitive Risks">潛在風險</SectionTitle>
          <div className="space-y-3">
            {f.secRisks.map((r) => (
              <Card key={r.title} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium text-ink">{r.title}</div>
                  <Badge tone={r.severity === 'High' ? 'down' : r.severity === 'Medium' ? 'warn' : 'neutral'}>
                    <TriangleAlert className="h-3 w-3" aria-hidden />
                    嚴重度 {r.severity === 'High' ? '高' : r.severity === 'Medium' ? '中' : '低'}
                  </Badge>
                </div>
                <div className="mt-0.5 text-[11px] text-ink-3">來源：{r.source}</div>
                <p className="mt-2 text-xs leading-relaxed text-ink-2">{r.description}</p>
                {r.mitigation && <p className="mt-2 rounded-md bg-surface-2 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-3"><span className="text-ink-2">緩解因素：</span>{r.mitigation}</p>}
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
