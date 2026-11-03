#!/usr/bin/env node
/**
 * 技術面與籌碼數據計算器 —— 讓每台電腦、每次分析的技術指標口徑完全一致。
 *
 *   npm run market-data -- MRVL                      預設基準 SPY QQQ SMH
 *   npm run market-data -- MRVL --sector IGV --peers AVGO,LITE
 *   npm run market-data -- MRVL --out tmp/MRVL-market.json
 *
 * 計算內容（皆以日線收盤價，截至最近一個交易日）：
 *   SMA20/50/200、RSI14（Wilder）、MACD(12,26,9)、YTD Anchored VWAP、50 日均量、52 週高低
 *   相對強弱：1M / 3M / YTD / 1Y 報酬（本檔 vs 基準與同業）
 *   選擇權（Nasdaq OI）：各到期日 Max Pain、Put/Call（OI、成交量）、Call/Put Wall、Gamma Flip（單一 IV 假設）
 *   空單（Nasdaq 半月結算）：Short Interest、Days to Cover
 * 資料來源：Yahoo Finance chart API、Nasdaq API（皆為公開端點；若失效請改用瀏覽器查詢並在 meta.dataQualityNotes 揭露）。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const DAY = 86400000;

function parseArgs(argv) {
  const out = { ticker: null, sector: 'SMH', peers: [], out: null, iv: 0.75, expiries: 8 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sector') out.sector = argv[++i].toUpperCase();
    else if (a === '--peers') out.peers = argv[++i].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--iv') out.iv = Number(argv[++i]);
    else if (a === '--expiries') out.expiries = Number(argv[++i]);
    else if (!a.startsWith('--')) out.ticker = a.toUpperCase();
  }
  return out;
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

// ---------- 價格 ----------
async function history(symbol) {
  const j = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1d`);
  const r = j?.chart?.result?.[0];
  if (!r) throw new Error(`${symbol}: Yahoo 無資料`);
  const q = r.indicators.quote[0];
  const off = (r.meta.gmtoffset || 0) * 1000;
  const rows = [];
  r.timestamp.forEach((t, i) => {
    if (q.close[i] == null) return;
    const d = new Date(t * 1000 + off);
    rows.push({ date: d.toISOString().slice(0, 10), open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
  });
  return rows;
}

const r2 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
const r1 = (n) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const sma = (arr, n) => (arr.length >= n ? arr.slice(-n).reduce((a, b) => a + b, 0) / n : null);

function emaSeries(arr, n) {
  const k = 2 / (n + 1);
  const out = [arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] * k + out[i - 1] * (1 - k));
  return out;
}

function rsiWilder(closes, n = 14) {
  if (closes.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }
  let ag = gain / n, al = loss / n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

function anchoredVwap(rows, fromDate) {
  let pv = 0, v = 0;
  for (const r of rows) if (r.date >= fromDate) {
    pv += ((r.high + r.low + r.close) / 3) * r.volume;
    v += r.volume;
  }
  return v ? pv / v : null;
}

function returns(rows) {
  const last = rows.at(-1);
  const lastT = Date.parse(last.date);
  const baseOn = (t) => [...rows].reverse().find((r) => Date.parse(r.date) <= t)?.close;
  const ytdBase = [...rows].reverse().find((r) => r.date < `${last.date.slice(0, 4)}-01-01`)?.close;
  const pct = (b) => (b ? ((last.close / b) - 1) * 100 : null);
  return { m1: r1(pct(baseOn(lastT - 30 * DAY))), m3: r1(pct(baseOn(lastT - 91 * DAY))), ytd: r1(pct(ytdBase)), y1: r1(pct(baseOn(lastT - 365 * DAY))) };
}

function technicals(rows) {
  const closes = rows.map((r) => r.close);
  const last = rows.at(-1);
  const e12 = emaSeries(closes, 12), e26 = emaSeries(closes, 26);
  const macd = e12.map((v, i) => v - e26[i]);
  const signal = emaSeries(macd, 9);
  const hist = macd.at(-1) - signal.at(-1);
  const prevHist = macd.at(-2) - signal.at(-2);
  const yearAgo = Date.parse(last.date) - 365 * DAY;
  const yr = rows.filter((r) => Date.parse(r.date) > yearAgo);
  const hi = yr.reduce((a, r) => (r.high > a.high ? r : a), yr[0]);
  const lo = yr.reduce((a, r) => (r.low < a.low ? r : a), yr[0]);
  const rsi = rsiWilder(closes);
  return {
    asOf: last.date,
    close: r2(last.close),
    changePct: r2(((last.close / rows.at(-2).close) - 1) * 100),
    sma20: r2(sma(closes, 20)),
    sma50: r2(sma(closes, 50)),
    sma200: r2(sma(closes, 200)),
    vwapYTD: r2(anchoredVwap(rows, `${last.date.slice(0, 4)}-01-01`)),
    rsi14: r1(rsi),
    rsiState: rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Neutral',
    macd: {
      line: r2(macd.at(-1)),
      signal: r2(signal.at(-1)),
      histogram: r2(hist),
      state: hist > 0 && prevHist <= 0 ? 'BullishCross' : hist < 0 && prevHist >= 0 ? 'BearishCross' : hist > 0 ? 'Bullish' : hist < 0 ? 'Bearish' : 'Neutral',
    },
    avgVolume50dM: r1(sma(rows.map((r) => r.volume), 50) / 1e6),
    priceRange52w: { high: r2(hi.high), highDate: hi.date, low: r2(lo.low), lowDate: lo.date },
    maxClose52w: r2(Math.max(...yr.map((r) => r.close))),
    last10: rows.slice(-10).map((r) => ({ date: r.date, close: r2(r.close), high: r2(r.high), low: r2(r.low), volumeM: r1(r.volume / 1e6) })),
    monthly: monthlyHL(rows.slice(-260)),
  };
}

function monthlyHL(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    const m = map.get(k) || { month: k, high: -Infinity, low: Infinity, close: null };
    m.high = Math.max(m.high, r.high);
    m.low = Math.min(m.low, r.low);
    m.close = r.close;
    map.set(k, m);
  }
  return [...map.values()].map((m) => ({ month: m.month, high: r2(m.high), low: r2(m.low), close: r2(m.close) }));
}

// ---------- 選擇權（Nasdaq OI） ----------
const num = (x) => {
  const n = Number(String(x ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** 一次取回 asOf 起約 100 天內的所有到期日，依 expirygroup 標題列切分，取前 count 個 */
async function optionChains(ticker, count, asOf) {
  const to = new Date(Date.parse(asOf) + 100 * DAY).toISOString().slice(0, 10);
  const url = `https://api.nasdaq.com/api/quote/${ticker}/option-chain?assetclass=stocks&limit=10000&fromdate=${asOf}&todate=${to}&excode=oprac&callput=callput&money=all&type=all`;
  const j = await getJson(url);
  const chains = [];
  let cur = null;
  for (const r of j?.data?.table?.rows || []) {
    if (r.expirygroup) {
      const d = new Date(`${r.expirygroup} 12:00 UTC`);
      cur = Number.isNaN(d.getTime()) ? null : { expiry: d.toISOString().slice(0, 10), calls: [], puts: [] };
      if (cur) chains.push(cur);
      continue;
    }
    if (!cur || !r.strike) continue;
    cur.calls.push({ k: num(r.strike), oi: num(r.c_Openinterest), vol: num(r.c_Volume) });
    cur.puts.push({ k: num(r.strike), oi: num(r.p_Openinterest), vol: num(r.p_Volume) });
  }
  return chains.filter((c) => c.calls.length).slice(0, count);
}

const pdf = (x) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
function gamma(S, K, T, iv) {
  if (T <= 0 || iv <= 0 || K <= 0) return 0;
  const d1 = (Math.log(S / K) + 0.5 * iv * iv * T) / (iv * Math.sqrt(T));
  return pdf(d1) / (S * iv * Math.sqrt(T));
}

function optionsSummary(chains, spot, asOf, iv) {
  const now = Date.parse(asOf);
  let cOI = 0, pOI = 0, cV = 0, pV = 0;
  const aggC = new Map(), aggP = new Map();
  const maxPain = [];
  for (const ch of chains) {
    const strikes = [...new Set(ch.calls.map((c) => c.k))].sort((a, b) => a - b);
    let best = null;
    for (const k of strikes) {
      const pain = ch.calls.reduce((a, c) => a + c.oi * Math.max(k - c.k, 0), 0) + ch.puts.reduce((a, p) => a + p.oi * Math.max(p.k - k, 0), 0);
      if (!best || pain < best.pain) best = { k, pain };
    }
    if (best) maxPain.push({ expiry: ch.expiry, price: best.k });
    for (const c of ch.calls) { cOI += c.oi; cV += c.vol; aggC.set(c.k, (aggC.get(c.k) || 0) + c.oi); }
    for (const p of ch.puts) { pOI += p.oi; pV += p.vol; aggP.set(p.k, (aggP.get(p.k) || 0) + p.oi); }
  }
  const netGex = (S) => chains.reduce((acc, ch) => {
    const T = Math.max((Date.parse(ch.expiry) - now) / (365 * DAY), 1 / 365);
    const c = ch.calls.reduce((a, x) => a + x.oi * gamma(S, x.k, T, iv), 0);
    const p = ch.puts.reduce((a, x) => a + x.oi * gamma(S, x.k, T, iv), 0);
    return acc + (c - p) * 100 * S * S * 0.01;
  }, 0);
  let flip = null;
  let prev = null;
  for (let S = Math.round(spot * 0.6); S <= Math.round(spot * 1.6); S += Math.max(spot / 200, 0.5)) {
    const g = netGex(S);
    if (prev && Math.sign(prev.g) !== Math.sign(g)) {
      const cand = (prev.S + S) / 2;
      if (!flip || Math.abs(cand - spot) < Math.abs(flip - spot)) flip = cand;
    }
    prev = { S, g };
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, oi]) => ({ strike: k, oi }));
  const gexSpot = netGex(spot);
  return {
    asOf,
    method: `Nasdaq OI，${chains.length} 個到期日；Gamma 以單一 IV ${Math.round(iv * 100)}% 估算`,
    putCallRatioOI: cOI ? r2(pOI / cOI) : null,
    putCallRatioVolume: cV ? r2(pV / cV) : null,
    maxPain,
    topCallOI: top(aggC, 6),
    topPutOI: top(aggP, 6),
    gammaFlip: flip ? r2(flip) : null,
    netGexPer1PctUSDm: r1(gexSpot / 1e6),
    netGammaRegime: Math.abs(gexSpot) < 1e6 ? 'Neutral' : gexSpot > 0 ? 'Positive' : 'Negative',
  };
}

async function shortInterest(ticker) {
  const j = await getJson(`https://api.nasdaq.com/api/quote/${ticker}/short-interest?assetClass=stocks`);
  return (j?.data?.shortInterestTable?.rows || []).slice(0, 6).map((r) => {
    const [mm, dd, yy] = String(r.settlementDate).split('/');
    return { settlementDate: `${yy}-${mm}-${dd}`, sharesShortM: r1(num(r.interest) / 1e6), daysToCover: r2(num(r.daysToCover)), avgDailyVolumeM: r1(num(r.avgDailyShareVolume) / 1e6) };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ticker) {
    console.error('用法：npm run market-data -- <TICKER> [--sector SMH] [--peers AVGO,NVDA] [--out file.json] [--iv 0.6]');
    process.exit(1);
  }
  const benchmarks = ['SPY', 'QQQ', args.sector, ...args.peers].filter((v, i, a) => v && a.indexOf(v) === i && v !== args.ticker);
  const rows = await history(args.ticker);
  const tech = technicals(rows);
  const rel = { [args.ticker]: returns(rows) };
  for (const b of benchmarks) {
    try {
      rel[b] = returns(await history(b));
    } catch (e) {
      rel[b] = { error: e.message };
    }
  }
  const result = { ticker: args.ticker, generatedAt: new Date().toISOString(), technicals: tech, relativeStrength: rel };
  try {
    const chains = await optionChains(args.ticker, args.expiries, tech.asOf);
    result.options = optionsSummary(chains, tech.close, tech.asOf, args.iv);
  } catch (e) {
    result.options = { error: `選擇權資料取得失敗：${e.message}` };
  }
  try {
    result.shortInterest = await shortInterest(args.ticker);
  } catch (e) {
    result.shortInterest = { error: `空單資料取得失敗：${e.message}` };
  }
  const text = JSON.stringify(result, null, 2);
  if (args.out) {
    await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
    await fs.writeFile(args.out, `${text}\n`, 'utf8');
    console.error(`已寫入 ${args.out}`);
  }
  console.log(text);
}

main().catch((e) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
