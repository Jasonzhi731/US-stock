// 由分析 JSON + 即時報價推導顯示用指標（所有百分比為百分點）

export const pctChange = (target, price) => (price ? ((target - price) / price) * 100 : null);

export function zoneOf(price, z) {
  if (price <= z.cheap.max) return 'cheap';
  if (price < z.fair.low) return 'below-fair';
  if (price <= z.fair.high) return 'fair';
  if (price < z.expensive.min) return 'above-fair';
  return 'expensive';
}

export function deriveMetrics(stock) {
  const a = stock.analysis;
  const v = a.valuation;
  const live = stock.live;
  const isLive = typeof live?.price === 'number' && live.price > 0;
  const price = isLive ? live.price : v.currentPrice;
  const s = v.scenarios;

  const scenarios = ['bear', 'base', 'bull'].map((key) => ({
    key,
    ...s[key],
    liveUpsidePct: pctChange(s[key].targetPrice, price),
  }));
  const weightedTarget = scenarios.reduce((acc, sc) => acc + (sc.targetPrice * sc.probabilityPct) / 100, 0);

  const street = v.streetConsensus;
  const range = a.technicals.priceRange52w;
  const high52 = isLive && live.high52w ? live.high52w : range.high;
  const low52 = isLive && live.low52w ? live.low52w : range.low;
  const pos52 = high52 > low52 ? ((price - low52) / (high52 - low52)) * 100 : null;

  const ratings = street.ratings;
  const ratingTotal = ratings.buy + ratings.hold + ratings.sell;

  return {
    ticker: v.ticker,
    price,
    isLive,
    priceSource: isLive ? 'GOOGLEFINANCE' : `分析當日收盤（${v.priceDate}）`,
    changePct: isLive ? live.changePct : null,
    marketCap: isLive && live.marketCap ? live.marketCap : price * v.sharesOutstandingM * 1e6,
    marketCapEstimated: !(isLive && live.marketCap),
    scenarios,
    base: scenarios[1],
    weightedTarget,
    weightedUpsidePct: pctChange(weightedTarget, price),
    streetMedian: street.medianTarget,
    streetUpsidePct: pctChange(street.medianTarget, price),
    expectationGapPct: pctChange(s.base.targetPrice, street.medianTarget), // 我方 base 相對華爾街中位數
    buyPct: ratingTotal ? (ratings.buy / ratingTotal) * 100 : null,
    high52,
    low52,
    pos52,
    offHighPct: pctChange(price, high52),
    zone: zoneOf(price, v.priceZones),
    forwardPE: v.priceZones.forwardEPS ? price / v.priceZones.forwardEPS : null,
  };
}
