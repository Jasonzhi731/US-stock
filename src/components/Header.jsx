import { Cloud, CloudOff, HardDrive, Moon, RefreshCw, Sun } from 'lucide-react';
import { cx } from './ui.jsx';
import { fmtDateTime } from '../lib/format.js';

const STATUS = {
  'local-only': { icon: HardDrive, label: '本地資料', detail: '未設定 VITE_GAS_API_URL，顯示建置時打包的 /data 分析', tone: 'text-ink-2' },
  syncing: { icon: RefreshCw, label: '同步中', detail: '向 Google Sheets 拉取最新分析與 GOOGLEFINANCE 報價…', tone: 'text-accent', spin: true },
  live: { icon: Cloud, label: '即時 · Google Sheets', detail: 'GOOGLEFINANCE 報價（約延遲 20 分鐘），每 5 分鐘自動刷新', tone: 'text-up' },
  error: { icon: CloudOff, label: '雲端連線失敗', detail: '暫以本地資料顯示', tone: 'text-down' },
};

export default function Header({ theme, onToggleTheme, data }) {
  const st = STATUS[data.status] || STATUS['local-only'];
  const Icon = st.icon;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
        <a href="#/" className="flex min-w-0 items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
            <rect width="32" height="32" rx="7" fill="var(--surface-3)" />
            <path d="M7 22l6-7 4 4 8-10" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="25" cy="9" r="2.5" fill="var(--series-1)" />
          </svg>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-ink">美股深度分析終端</div>
            <div className="num truncate text-[10.5px] tracking-wide text-ink-3">US EQUITY RESEARCH TERMINAL</div>
          </div>
        </a>
        <div className="flex items-center gap-2">
          <div
            className={cx('flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs', st.tone)}
            title={`${st.detail}${data.error ? `（${data.error}）` : ''}${data.lastSync ? `\n最後同步：${fmtDateTime(data.lastSync)}` : ''}`}
          >
            <Icon className={cx('h-3.5 w-3.5', st.spin && 'animate-spin')} aria-hidden />
            <span className="hidden sm:inline">{st.label}</span>
            {data.lastSync && <span className="num hidden text-ink-3 md:inline">{fmtDateTime(data.lastSync)}</span>}
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-lg border border-line bg-surface p-2 text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={theme === 'dark' ? '切換為淺色模式' : '切換為深色模式'}
            title={theme === 'dark' ? '淺色模式' : '深色模式'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
