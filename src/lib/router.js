import { useEffect, useState } from 'react';

export const TABS = [
  { key: 'fundamentals', zh: '基本面與財測指引', en: 'Fundamentals & Guidance' },
  { key: 'technicals', zh: '技術與美股籌碼面', en: 'Technicals & Flow' },
  { key: 'catalysts', zh: '消息與催化劑時間軸', en: 'Catalysts' },
  { key: 'valuation', zh: '估值模型與華爾街對照', en: 'Valuation' },
  { key: 'changelog', zh: '歷史觀點演進', en: 'Changelog' },
];

function parse(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'stock' && parts[1]) {
    const tab = TABS.some((t) => t.key === parts[2]) ? parts[2] : 'fundamentals';
    return { page: 'stock', ticker: decodeURIComponent(parts[1]).toUpperCase(), tab };
  }
  return { page: 'dashboard' };
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const stockHref = (ticker, tab) => `#/stock/${ticker}${tab ? `/${tab}` : ''}`;
