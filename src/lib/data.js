import { useEffect, useRef, useState } from 'react';

// 1) 本地資料：建置時打包 /data/stocks/*.json → 首屏立即可用（秒開）
const localModules = import.meta.glob('../../data/stocks/*.json', { eager: true, import: 'default' });
export const LOCAL_ANALYSES = Object.values(localModules)
  .filter((d) => d && d.valuation && d.valuation.ticker)
  .sort((a, b) => a.valuation.ticker.localeCompare(b.valuation.ticker));

// 2) 雲端資料：Google Apps Script Web App（GOOGLEFINANCE 即時報價 + Sheets 上的最新分析）
export const GAS_URL = (import.meta.env.VITE_GAS_API_URL || '').trim();
const QUOTE_REFRESH_MS = 5 * 60 * 1000;
const CACHE_KEY = 'usx-live-cache-v1';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(stocks, generatedAt) {
  try {
    const quotes = {};
    for (const s of stocks) if (s.live) quotes[s.ticker] = s.live;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ generatedAt, quotes }));
  } catch {
    /* 私密視窗或封鎖儲存時忽略 */
  }
}

function jsonp(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const cb = `__usx_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => cleanup(new Error('JSONP timeout')), timeoutMs);
    function cleanup(err, data) {
      clearTimeout(timer);
      delete window[cb];
      script.remove();
      if (err) reject(err);
      else resolve(data);
    }
    window[cb] = (data) => cleanup(null, data);
    script.onerror = () => cleanup(new Error('JSONP load error'));
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${cb}`;
    document.head.appendChild(script);
  });
}

export async function fetchGas(action, signal) {
  const u = new URL(GAS_URL);
  u.searchParams.set('action', action);
  let json;
  try {
    const res = await fetch(u.toString(), { signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    json = await jsonp(u.toString()); // CORS 或重新導向受阻時的備援
  }
  if (!json || json.ok === false) throw new Error(json?.error || 'GAS 回應無效');
  return json;
}

const toTime = (s) => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
};

/** 以 base 清單為底，套入雲端分析（較新者勝出）與即時報價 */
export function mergeRemote(base, remoteStocks) {
  const map = new Map(base.map((s) => [s.ticker, { ...s }]));
  for (const r of remoteStocks || []) {
    const ticker = String(r.ticker || '').toUpperCase();
    if (!ticker) continue;
    const cur = map.get(ticker);
    const remoteA = r.analysis && r.analysis.valuation ? r.analysis : null;
    let next = cur;
    if (remoteA && (!cur || toTime(remoteA.valuation.updatedAt) > toTime(cur.analysis.valuation.updatedAt))) {
      next = { ticker, ...(cur || {}), analysis: remoteA, analysisSource: 'sheets' };
    }
    if (!next) continue; // 只有報價、沒有分析的股票不顯示
    if (r.live && typeof r.live.price === 'number') next = { ...next, live: { ...r.live } };
    map.set(ticker, next);
  }
  return [...map.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function initialStocks() {
  const base = LOCAL_ANALYSES.map((a) => ({ ticker: a.valuation.ticker, analysis: a, analysisSource: 'local', live: null }));
  const cache = GAS_URL ? readCache() : null;
  if (!cache?.quotes) return { stocks: base, cachedAt: null };
  return {
    stocks: base.map((s) => (cache.quotes[s.ticker] ? { ...s, live: { ...cache.quotes[s.ticker], source: 'cache' } } : s)),
    cachedAt: cache.generatedAt,
  };
}

/**
 * 混合資料源：先用本地 JSON 秒開，再於背景向 GAS 拉最新分析與 GOOGLEFINANCE 報價，之後每 5 分鐘刷新報價。
 * status: 'local-only' | 'syncing' | 'live' | 'error'
 */
export function useStockData() {
  const [state, setState] = useState(() => {
    const init = initialStocks();
    return {
      stocks: init.stocks,
      status: GAS_URL ? 'syncing' : 'local-only',
      error: null,
      lastSync: init.cachedAt,
    };
  });
  const stocksRef = useRef(state.stocks);
  stocksRef.current = state.stocks;

  useEffect(() => {
    if (!GAS_URL) return undefined;
    const ctrl = new AbortController();
    let timer;

    const load = async (action) => {
      setState((s) => ({ ...s, status: 'syncing' }));
      try {
        const json = await fetchGas(action, ctrl.signal);
        const stocks = mergeRemote(stocksRef.current, json.stocks);
        writeCache(stocks, json.generatedAt);
        setState({ stocks, status: 'live', error: null, lastSync: json.generatedAt });
      } catch (err) {
        if (err.name === 'AbortError') return;
        setState((s) => ({ ...s, status: 'error', error: err.message }));
      }
    };

    load('list');
    timer = setInterval(() => load('quotes'), QUOTE_REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, []);

  return state;
}
