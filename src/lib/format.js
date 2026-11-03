const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function fmtUsd(n, digits = 2) {
  if (!isNum(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** 百分點 → "+26.0%" */
export function fmtPct(n, digits = 1, { sign = true } = {}) {
  if (!isNum(n)) return '—';
  const s = n.toFixed(digits);
  return `${sign && n > 0 ? '+' : ''}${s}%`;
}

export function fmtNum(n, digits = 2) {
  if (!isNum(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 以美元計的大數 → $154.3B */
export function fmtBigUsd(n) {
  if (!isNum(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return fmtUsd(n, 0);
}

/** 百萬美元 → $2,739M 或 $9.45B */
export function fmtUsdM(m, { compact = false } = {}) {
  if (!isNum(m)) return '—';
  if (compact && Math.abs(m) >= 1000) return `${m < 0 ? '−' : ''}$${(Math.abs(m) / 1000).toFixed(2)}B`;
  return `${m < 0 ? '−' : ''}$${Math.abs(m).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
}

export function fmtShares(n) {
  if (!isNum(n)) return '—';
  return n.toLocaleString('en-US');
}

export function fmtDate(s) {
  if (!s) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s;
}

export function fmtDateTime(s) {
  if (!s) return '—';
  const d = s instanceof Date ? s : new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 正負號對應的文字顏色 class（漲跌、潛在空間） */
export function signClass(n) {
  if (!isNum(n) || n === 0) return 'text-ink-2';
  return n > 0 ? 'text-up' : 'text-down';
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
