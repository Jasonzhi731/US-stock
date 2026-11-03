import { Activity, Crosshair, Gauge, Landmark, Scale, TrendingDown, TrendingUp, Minus, Users, Zap } from 'lucide-react';
import { Badge, Card, CardHeader, KV, SectionTitle, cx } from '../ui.jsx';
import { LevelLadder } from '../charts.jsx';
import { fmtDate, fmtNum, fmtPct, fmtShares, fmtUsd, signClass } from '../../lib/format.js';
import {
  BENCH_ROLE, DIRECTION, GAMMA_REGIME, GAMMA_TYPE, HOLDER_ACTION, INSIDER_TYPE, KEY_LEVEL, KEY_LEVEL_ORDER,
  MACD_STATE, NET_ACTIVITY, RSI_STATE, SHORT_TREND,
} from '../../lib/labels.js';
import { pctChange } from '../../lib/metrics.js';

const DIR_ICON = { Bullish: TrendingUp, Bearish: TrendingDown, Neutral: Minus };
const DIR_TONE = { Bullish: 'up', Bearish: 'down', Neutral: 'neutral' };
const WINDOWS = [['m1', '1M'], ['m3', '3M'], ['ytd', 'YTD'], ['y1', '1Y']];

export default function TechnicalsTab({ a, m }) {
  const t = a.technicals;
  const ts = t.trendSummary;
  const ma = ts.movingAverages;
  const rs = t.relativeStrength;
  const flow = t.marketStructureAndFlow;
  const levels = [...t.keyLevels].sort((x, y) => KEY_LEVEL_ORDER.indexOf(x.type) - KEY_LEVEL_ORDER.indexOf(y.type));
  const maRows = [
    ['20 SMA', ma.sma20],
    ['50 SMA', ma.sma50],
    ['200 SMA', ma.sma200],
    [`VWAP（${ma.vwap.anchor}）`, ma.vwap.value],
  ];

  return (
    <div>
      <SectionTitle icon={Activity} en={`Trend Summary · 資料截至 ${fmtDate(t.asOf)}`}>趨勢總覽</SectionTitle>
      <div className="grid gap-3 md:grid-cols-3">
        {[['短線', ts.shortTerm], ['中線', ts.mediumTerm], ['長線', ts.longTerm]].map(([label, item]) => {
          const Icon = DIR_ICON[item.direction];
          return (
            <Card key={label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{label}趨勢</span>
                <Badge tone={DIR_TONE[item.direction]}><Icon className="h-3 w-3" aria-hidden />{item.direction} {DIRECTION[item.direction]}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{item.comment}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader icon={Scale} title="均線與 VWAP 相對位置" en={m.isLive ? '以即時價計算' : '以分析日收盤計算'} />
          <div className="divide-y divide-line px-4">
            {maRows.map(([label, value]) => {
              const dist = pctChange(m.price, value);
              const above = m.price >= value;
              return (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink-2" title={label}>{label}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="num text-ink">{fmtUsd(value)}</span>
                    <Badge tone={above ? 'up' : 'down'}>{above ? '站上' : '跌破'} <span className="num">{fmtPct(dist)}</span></Badge>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-2">{ts.summary}</p>
          <div className="border-t border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
              <span>52 週區間</span>
              <span className="num">{fmtDate(t.priceRange52w.lowDate)} 低 / {fmtDate(t.priceRange52w.highDate)} 高</span>
            </div>
            <KV k="52W High" v={fmtUsd(m.high52)} />
            <KV k="52W Low" v={fmtUsd(m.low52)} />
            <KV k="距 52W 高點" v={<span className={signClass(m.offHighPct)}>{fmtPct(m.offHighPct)}</span>} />
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader icon={Crosshair} title="關鍵價位表" en="Key Levels" />
          <div className="px-2 pt-3">
            <LevelLadder
              levels={levels}
              price={m.price}
              labels={KEY_LEVEL}
              markers={[
                { label: 'SMA20', price: ma.sma20 },
                { label: 'SMA50', price: ma.sma50 },
                { label: 'SMA200', price: ma.sma200 },
                { label: 'VWAP', price: ma.vwap.value },
              ]}
            />
          </div>
          <div className="divide-y divide-line border-t border-line">
            {levels.map((l) => {
              const side = KEY_LEVEL[l.type].side;
              return (
                <div key={l.type} className="grid grid-cols-[96px_1fr] gap-3 px-4 py-2.5 sm:grid-cols-[150px_1fr]">
                  <div>
                    <div className={cx('text-sm font-medium', side === 'support' ? 'text-up' : side === 'resistance' ? 'text-down' : 'text-accent')}>{KEY_LEVEL[l.type].zh}</div>
                    <div className="text-[10.5px] text-ink-3">{KEY_LEVEL[l.type].en}</div>
                    <div className="num mt-0.5 text-sm text-ink">{fmtUsd(l.price)}</div>
                    {l.rangeLow && l.rangeHigh && <div className="num text-[10.5px] text-ink-3">{fmtUsd(l.rangeLow)}–{fmtUsd(l.rangeHigh)}</div>}
                  </div>
                  <div className="text-xs leading-relaxed text-ink-2">
                    {l.significance}
                    <div className="num mt-1 text-[10.5px] text-ink-3">距現價 {fmtPct(pctChange(l.price, m.price))}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <SectionTitle icon={Gauge} en="Relative Strength">相對強弱</SectionTitle>
      <Card className="overflow-hidden">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-3">
                <th className="px-4 py-2 font-medium">標的</th>
                <th className="px-4 py-2 font-medium">類別</th>
                {WINDOWS.map(([, l]) => <th key={l} className="px-4 py-2 text-right font-medium">{l}</th>)}
                {WINDOWS.map(([, l]) => <th key={`rel-${l}`} className="px-4 py-2 text-right font-medium">{a.valuation.ticker} 超額 {l}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line bg-accent-soft/40">
                <td className="num px-4 py-2 font-bold text-ink">{a.valuation.ticker}</td>
                <td className="px-4 py-2 text-xs text-ink-3">本檔</td>
                {WINDOWS.map(([k]) => <td key={k} className={cx('num px-4 py-2 text-right', signClass(rs.stockReturns[k]))}>{fmtPct(rs.stockReturns[k])}</td>)}
                {WINDOWS.map(([k]) => <td key={`r-${k}`} className="px-4 py-2 text-right text-ink-3">—</td>)}
              </tr>
              {rs.benchmarks.map((b) => (
                <tr key={b.symbol} className="border-b border-line last:border-0">
                  <td className="px-4 py-2"><span className="num font-semibold text-ink">{b.symbol}</span><span className="ml-2 text-xs text-ink-3">{b.name}</span></td>
                  <td className="px-4 py-2 text-xs text-ink-3">{BENCH_ROLE[b.role]}</td>
                  {WINDOWS.map(([k]) => <td key={k} className={cx('num px-4 py-2 text-right', signClass(b.returns[k]))}>{fmtPct(b.returns[k])}</td>)}
                  {WINDOWS.map(([k]) => {
                    const rel = rs.stockReturns[k] != null && b.returns[k] != null ? rs.stockReturns[k] - b.returns[k] : null;
                    return <td key={`r-${k}`} className={cx('num px-4 py-2 text-right', signClass(rel))}>{rel == null ? '—' : `${rel > 0 ? '+' : ''}${rel.toFixed(1)} pt`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-2">{rs.commentary}</p>
      </Card>

      <SectionTitle icon={Zap} en="Market Structure & Flow">量價、籌碼與衍生品訊號</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader icon={Activity} title="RSI / MACD 量價" />
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-ink-2">RSI(14)</span>
                <span><span className="num font-semibold text-ink">{fmtNum(flow.momentum.rsi14, 1)}</span> <Badge tone={flow.momentum.rsiState === 'Oversold' ? 'up' : flow.momentum.rsiState === 'Overbought' ? 'down' : 'neutral'}>{RSI_STATE[flow.momentum.rsiState]}</Badge></span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-3">
                <div className="absolute inset-y-0 left-[30%] right-[30%] bg-surface-2" aria-hidden />
                <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-s1" style={{ left: `${flow.momentum.rsi14}%` }} />
              </div>
              <div className="num mt-1 flex justify-between text-[10px] text-ink-3"><span>0</span><span>30</span><span>70</span><span>100</span></div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-1">
              <KV k="MACD 線" v={fmtNum(flow.momentum.macd.line)} />
              <KV k="Signal" v={fmtNum(flow.momentum.macd.signal)} />
              <KV k="Histogram" v={<span className={signClass(flow.momentum.macd.histogram)}>{fmtNum(flow.momentum.macd.histogram)}</span>} />
              <KV k="狀態" v={MACD_STATE[flow.momentum.macd.state]} />
              <KV k="50 日均量" v={flow.momentum.avgVolume50dM != null ? `${fmtNum(flow.momentum.avgVolume50dM, 1)}M 股` : '—'} />
            </div>
            <p className="text-xs leading-relaxed text-ink-2">{flow.momentum.volumeComment}</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={TrendingDown} title="做空比例 Short Interest" en={`結算日 ${fmtDate(flow.shortInterest.asOf)}`} />
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['% of Float', fmtPct(flow.shortInterest.pctOfFloat, 1, { sign: false })],
                ['Days to Cover', flow.shortInterest.daysToCover != null ? fmtNum(flow.shortInterest.daysToCover, 2) : '—'],
                ['空單股數', flow.shortInterest.sharesShortM != null ? `${fmtNum(flow.shortInterest.sharesShortM, 1)}M` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2 px-2 py-2">
                  <div className="text-[10.5px] text-ink-3">{k}</div>
                  <div className="num mt-0.5 text-base font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-ink-3">趨勢：<span className="text-ink">{SHORT_TREND[flow.shortInterest.trend]}</span></div>
            <p className="text-xs leading-relaxed text-ink-2">{flow.shortInterest.comment}</p>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Crosshair} title="選擇權訊號" en={`截至 ${fmtDate(flow.options.asOf)}`} />
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['P/C (OI)', flow.options.putCallRatioOI != null ? fmtNum(flow.options.putCallRatioOI, 2) : '—'],
                ['P/C (Vol)', flow.options.putCallRatioVolume != null ? fmtNum(flow.options.putCallRatioVolume, 2) : '—'],
                ['IV30', fmtPct(flow.options.iv30Pct, 1, { sign: false })],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2 px-2 py-2">
                  <div className="text-[10.5px] text-ink-3">{k}</div>
                  <div className="num mt-0.5 text-base font-semibold text-ink">{v}</div>
                </div>
              ))}
            </div>
            <Badge tone={flow.options.netGammaRegime === 'Negative' ? 'down' : flow.options.netGammaRegime === 'Positive' ? 'up' : 'neutral'}>{GAMMA_REGIME[flow.options.netGammaRegime]}</Badge>
            <div>
              <div className="mb-1 text-[11px] text-ink-3">Max Pain</div>
              <div className="flex flex-wrap gap-1.5">
                {flow.options.maxPain.map((mp) => (
                  <span key={mp.expiry} className="num rounded-md bg-surface-2 px-2 py-1 text-[11px] text-ink-2">{mp.expiry.slice(5).replace('-', '/')} <span className="font-semibold text-ink">{fmtUsd(mp.price, 0)}</span></span>
                ))}
              </div>
            </div>
            <div className="divide-y divide-line rounded-lg border border-line">
              {flow.options.gammaLevels.map((gl) => (
                <div key={`${gl.type}-${gl.price}`} className="px-3 py-2">
                  <div className="flex items-center justify-between text-xs">
                    <Badge tone={gl.type === 'CallWall' ? 'down' : gl.type === 'PutWall' ? 'up' : 'accent'}>{GAMMA_TYPE[gl.type]}</Badge>
                    <span className="num font-semibold text-ink">{fmtUsd(gl.price, 0)}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{gl.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-ink-2">{flow.options.comment}</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={Landmark} title="13F 機構持倉動向" en={flow.institutional.asOfQuarter} />
          <div className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[10.5px] text-ink-3">機構持股比例</div><div className="num font-semibold text-ink">{flow.institutional.ownershipPct != null ? fmtPct(flow.institutional.ownershipPct, 1, { sign: false }) : '—'}</div></div>
              <div className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[10.5px] text-ink-3">申報機構數</div><div className="num font-semibold text-ink">{flow.institutional.holdersCount != null ? fmtShares(flow.institutional.holdersCount) : '—'}</div></div>
            </div>
            <p className="text-xs leading-relaxed text-ink-2">{flow.institutional.summary}</p>
            <div className="mt-3 divide-y divide-line">
              {flow.institutional.notableHolders.map((h) => (
                <div key={h.holder} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-ink">{h.holder}</div>
                    <div className="text-[11px] leading-relaxed text-ink-3">{h.detail}</div>
                  </div>
                  <Badge tone={['Increased', 'New'].includes(h.action) ? 'up' : ['Decreased', 'Exited'].includes(h.action) ? 'down' : 'neutral'}>{HOLDER_ACTION[h.action]}</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader icon={Users} title="內部人交易 Form 4" en={flow.insider.period} right={<Badge tone={flow.insider.netActivity === 'NetBuy' ? 'up' : flow.insider.netActivity === 'NetSell' ? 'down' : 'neutral'}>{NET_ACTIVITY[flow.insider.netActivity]}</Badge>} />
          <p className="px-4 pt-3 text-xs leading-relaxed text-ink-2">{flow.insider.summary}</p>
          <div className="scrollbar-thin mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-ink-3">
                  {['日期', '內部人', '類型', '股數', '價格', '金額', '10b5-1'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {flow.insider.transactions.map((tx, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="num whitespace-nowrap px-3 py-2 text-ink-2">{fmtDate(tx.date)}</td>
                    <td className="px-3 py-2"><div className="text-ink">{tx.insider}</div><div className="text-[10.5px] text-ink-3">{tx.role}</div></td>
                    <td className="px-3 py-2"><Badge tone={tx.type === 'Buy' ? 'up' : tx.type === 'Sell' ? 'down' : 'neutral'}>{INSIDER_TYPE[tx.type]}</Badge></td>
                    <td className="num px-3 py-2 text-ink-2">{tx.shares != null ? fmtShares(tx.shares) : '—'}</td>
                    <td className="num px-3 py-2 text-ink-2">{fmtUsd(tx.price)}</td>
                    <td className="num px-3 py-2 text-ink-2">{tx.valueUSD != null ? `$${(tx.valueUSD / 1e6).toFixed(2)}M` : '—'}</td>
                    <td className="px-3 py-2 text-ink-3">{tx.plan10b51 == null ? '—' : tx.plan10b51 ? '是' : '否'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
