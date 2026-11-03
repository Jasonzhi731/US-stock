import { useCallback, useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import StockReport from './components/report/StockReport.jsx';
import { useStockData } from './lib/data.js';
import { useHashRoute } from './lib/router.js';

function useTheme() {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('usx-theme', theme);
    } catch {
      /* 儲存被封鎖時仍可切換，只是不記憶 */
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return [theme, toggle];
}

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const data = useStockData();
  const route = useHashRoute();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.page, route.ticker, route.tab]);

  const stock = route.page === 'stock' ? data.stocks.find((s) => s.ticker === route.ticker) : null;

  return (
    <div className="min-h-screen bg-bg">
      <Header theme={theme} onToggleTheme={toggleTheme} data={data} />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-5">
        {route.page === 'stock' ? (
          stock ? (
            <StockReport stock={stock} tab={route.tab} />
          ) : (
            <div className="py-24 text-center">
              <p className="text-ink-2">找不到 {route.ticker} 的分析資料。</p>
              <a href="#/" className="mt-3 inline-block text-sm text-accent hover:underline">回到總覽</a>
            </div>
          )
        ) : (
          <Dashboard stocks={data.stocks} />
        )}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-7xl space-y-1 px-4 py-6 text-[11px] leading-relaxed text-ink-3">
          <p>本網站內容為 AI 輔助的研究整理，僅供資訊參考，不構成任何投資建議或要約；作者並非持牌投資顧問，投資前請自行查證並評估風險。</p>
          <p>報價：Google Sheets GOOGLEFINANCE（可能延遲約 20 分鐘）；未連線時顯示分析當日收盤價。資料結構遵循 /schema/stock-analysis.schema.json。</p>
        </div>
      </footer>
    </div>
  );
}
