import { useMemo, useState } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { Badge, Card, CardHeader, cx } from '../ui.jsx';
import { fmtNum, fmtPct, fmtUsd, signClass } from '../../lib/format.js';
import { ZONE } from '../../lib/labels.js';
import { pctChange, zoneOf } from '../../lib/metrics.js';

function Slider({ id, label, hint, value, onChange, bound, format }) {
  const fill = ((value - bound.min) / (bound.max - bound.min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink-2">{label}</label>
        <span className="num text-base font-semibold text-ink">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={bound.min}
        max={bound.max}
        step={bound.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fill}%` }}
      />
      <div className="num flex justify-between text-[10px] text-ink-3">
        <span>{format(bound.min)}</span>
        {hint && <span className="text-ink-3">{hint}</span>}
        <span>{format(bound.max)}</span>
      </div>
    </div>
  );
}

function Output({ label, value, sub, emphasis }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2.5', emphasis ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-2')}>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-2">{sub}</div>}
    </div>
  );
}

export default function ValuationPlayground({ v, price }) {
  const z = v.priceZones;
  const b = z.sliderBounds;
  const defaults = { eps: z.forwardEPS, pe: z.targetPE, cagr: z.expectedCAGRPct, peg: z.pegTarget, mos: 15 };
  const [eps, setEps] = useState(defaults.eps);
  const [pe, setPe] = useState(defaults.pe);
  const [cagr, setCagr] = useState(defaults.cagr);
  const [peg, setPeg] = useState(defaults.peg);
  const [mos, setMos] = useState(defaults.mos);

  const reset = () => {
    setEps(defaults.eps);
    setPe(defaults.pe);
    setCagr(defaults.cagr);
    setPeg(defaults.peg);
    setMos(defaults.mos);
  };

  const out = useMemo(() => {
    const target = eps * pe;
    const pegFairPE = cagr * peg;
    return {
      target,
      upside: pctChange(target, price),
      marginOfSafety: target > 0 ? ((target - price) / target) * 100 : null,
      buyBelow: target * (1 - mos / 100),
      pegNow: cagr > 0 ? pe / cagr : null,
      pegFairPE,
      pegFairPrice: eps * pegFairPE,
      pegFairUpside: pctChange(eps * pegFairPE, price),
      impliedPE: eps > 0 ? price / eps : null,
      impliedCagr: eps > 0 && peg > 0 ? price / eps / peg : null,
      zone: zoneOf(target, z),
    };
  }, [eps, pe, cagr, peg, mos, price, z]);

  const epsSteps = [-20, -10, 0, 10, 20];
  const peSteps = [-10, -5, 0, 5, 10].map((d) => pe + d).filter((x) => x > 0);

  return (
    <Card>
      <CardHeader
        icon={Calculator}
        title="互動式估值試算器"
        en="Valuation & PEG Playground"
        right={
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:text-ink">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> 重設
          </button>
        }
      />
      <div className="grid gap-6 p-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <p className="text-xs leading-relaxed text-ink-3">預設值來自分析 JSON 的 priceZones（{z.basis}）。拖曳拉桿即時重算目標價、PEG 合理價與安全邊際；比較基準為{price === v.currentPrice ? '分析日收盤價' : '即時股價'} {fmtUsd(price)}。</p>
          <Slider id="pg-eps" label="預估 Non-GAAP EPS" hint="FY 基準" value={eps} onChange={setEps} bound={b.eps} format={(x) => fmtUsd(x)} />
          <Slider id="pg-pe" label="目標 Forward P/E 倍數" value={pe} onChange={setPe} bound={b.pe} format={(x) => `${fmtNum(x, 1)}x`} />
          <Slider id="pg-cagr" label="預期 EPS 年複合成長率" value={cagr} onChange={setCagr} bound={b.cagr} format={(x) => `${fmtNum(x, 0)}%`} />
          <Slider id="pg-peg" label="合理 PEG 倍數" value={peg} onChange={setPeg} bound={{ min: 0.3, max: 2.5, step: 0.01 }} format={(x) => fmtNum(x, 2)} />
          <Slider id="pg-mos" label="要求安全邊際" value={mos} onChange={setMos} bound={{ min: 0, max: 50, step: 1 }} format={(x) => `${x}%`} />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Output emphasis label="試算目標價（EPS × P/E）" value={fmtUsd(out.target)} sub={<span className={signClass(out.upside)}>相對現價 {fmtPct(out.upside)}</span>} />
            <Output label="安全邊際" value={<span className={signClass(out.marginOfSafety)}>{fmtPct(out.marginOfSafety, 1, { sign: false })}</span>} sub="（目標價 − 現價）÷ 目標價" />
            <Output label={`買進價上限（安全邊際 ${mos}%）`} value={fmtUsd(out.buyBelow)} sub={price <= out.buyBelow ? '現價已低於此價' : `需再下跌 ${fmtPct(pctChange(out.buyBelow, price))}`} />
            <Output label="目前 PEG（P/E ÷ 成長率）" value={out.pegNow != null ? fmtNum(out.pegNow, 2) : '—'} sub={out.pegNow != null ? (out.pegNow < 1 ? 'PEG < 1：成長相對便宜' : 'PEG ≥ 1：成長已反映') : '成長率為 0'} />
            <Output label={`PEG 合理價（P/E ${fmtNum(out.pegFairPE, 1)}x）`} value={fmtUsd(out.pegFairPrice)} sub={<span className={signClass(out.pegFairUpside)}>相對現價 {fmtPct(out.pegFairUpside)}</span>} />
            <Output label="現價隱含 P/E／所需成長率" value={out.impliedPE != null ? `${fmtNum(out.impliedPE, 1)}x` : '—'} sub={out.impliedCagr != null ? `在 PEG ${fmtNum(peg, 2)} 下需 EPS CAGR ${fmtNum(out.impliedCagr, 0)}%` : undefined} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            試算目標價落在：<Badge tone={ZONE[out.zone].tone === 'up' ? 'up' : ZONE[out.zone].tone === 'down' ? 'down' : 'neutral'}>{ZONE[out.zone].zh}</Badge>
            <span>（便宜 ≤ {fmtUsd(z.cheap.max, 0)}、合理 {fmtUsd(z.fair.low, 0)}–{fmtUsd(z.fair.high, 0)}、昂貴 ≥ {fmtUsd(z.expensive.min, 0)}）</span>
          </div>

          <div>
            <div className="mb-2 text-xs text-ink-3">敏感度分析：EPS 變動 × P/E 倍數 → 目標價與相對現價漲跌</div>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-ink-3">EPS ＼ P/E</th>
                    {peSteps.map((p) => (
                      <th key={p} className={cx('num px-2 py-1.5 text-right font-medium', p === pe ? 'text-accent' : 'text-ink-3')}>{fmtNum(p, 1)}x</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {epsSteps.map((d) => {
                    const e = eps * (1 + d / 100);
                    return (
                      <tr key={d}>
                        <th className={cx('num whitespace-nowrap px-2 py-1.5 text-left font-medium', d === 0 ? 'text-accent' : 'text-ink-3')}>
                          {fmtUsd(e)} <span className="text-[10px]">({d > 0 ? '+' : ''}{d}%)</span>
                        </th>
                        {peSteps.map((p) => {
                          const tp = e * p;
                          const up = pctChange(tp, price);
                          const alpha = Math.min(Math.abs(up) / 80, 1) * 42 + 6;
                          const bg = `color-mix(in srgb, ${up >= 0 ? 'var(--series-1)' : 'var(--down)'} ${alpha}%, transparent)`;
                          const isCenter = d === 0 && p === pe;
                          return (
                            <td key={p} className={cx('num rounded px-2 py-1.5 text-right text-ink', isCenter && 'ring-2 ring-accent')} style={{ background: bg }} title={`EPS ${fmtUsd(e)} × ${p}x`}>
                              <div className="font-semibold">{fmtUsd(tp, 0)}</div>
                              <div className="text-[10px] text-ink-2">{fmtPct(up, 0)}</div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-3">藍色＝高於現價、紅色＝低於現價，顏色深淺代表幅度；每格同時標示數值。</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
