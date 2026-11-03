#!/usr/bin/env node
/**
 * 美股分析 跨電腦雙向同步工具
 *
 *   npm run validate [TICKER...]          驗證 Schema 與資料一致性（build 前自動執行）
 *   npm run sync:index                    由 data/stocks/*.json 重建 data/index.json
 *   npm run sync:push [TICKER...]         驗證 → 重建索引 → 推送到 Google Sheets（未給代號則推全部）
 *   npm run sync:pull [-- --force]        從 Google Sheets 拉回 Full_Analysis_JSON 重建本地檔
 *   npm run sync:ping                     測試 GAS Web App 連線與 Token
 *
 * 參數：--dry-run 只顯示將做的事；--force（pull）即使本地較新也覆寫。
 * 讀取 .env / .env.local 的 VITE_GAS_API_URL 與 GAS_SECRET_TOKEN。
 */
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const STOCKS_DIR = path.join(DATA_DIR, 'stocks');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');
const SCHEMA_FILE = path.join(ROOT, 'schema', 'stock-analysis.schema.json');
const SCHEMA_REF_FROM_STOCK = '../../schema/stock-analysis.schema.json';
const SCHEMA_REF_FROM_INDEX = '../schema/stock-analysis.schema.json';
const KEY_LEVEL_TYPES = ['StrongSupport', 'SecondarySupport', 'Pivot', 'SecondaryResistance', 'MajorResistance'];

// ---------- console helpers ----------
const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const green = color(32), red = color(31), yellow = color(33), cyan = color(36), dim = color(2);
const ok = (msg) => console.log(`${green('✔')} ${msg}`);
const warn = (msg) => console.log(`${yellow('⚠')} ${msg}`);
const fail = (msg) => console.error(`${red('✖')} ${msg}`);

// ---------- env ----------
function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(ROOT, name);
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

// ---------- args ----------
function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a.slice(2));
    else positional.push(a);
  }
  return { flags, positional };
}

const normTicker = (t) => String(t).trim().toUpperCase();

// ---------- schema ----------
let validateFn;
async function getValidator() {
  if (validateFn) return validateFn;
  const schema = JSON.parse(await fs.readFile(SCHEMA_FILE, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  validateFn = ajv.compile(schema);
  return validateFn;
}

function formatAjvErrors(errors) {
  return (errors || [])
    .filter((e) => e.keyword !== 'if')
    .slice(0, 25)
    .map((e) => `    ${e.instancePath || '/'} ${e.message}${e.params && e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ''}${e.params && e.params.allowedValues ? ` ${JSON.stringify(e.params.allowedValues)}` : ''}`)
    .join('\n');
}

const round1 = (n) => Math.round(n * 10) / 10;
const upsidePct = (target, price) => ((target - price) / price) * 100;

/** Schema 無法表達的跨欄位一致性檢查。回傳 { errors, warnings } */
function consistencyCheck(doc, expectedTicker) {
  const errors = [];
  const warnings = [];
  const v = doc.valuation;
  const s = v.scenarios;

  if (expectedTicker && v.ticker !== expectedTicker) errors.push(`檔名代號 ${expectedTicker} 與 valuation.ticker ${v.ticker} 不一致`);
  if (!(s.bear.targetPrice < s.base.targetPrice && s.base.targetPrice < s.bull.targetPrice)) errors.push('目標價需滿足 bear < base < bull');

  const probSum = s.bear.probabilityPct + s.base.probabilityPct + s.bull.probabilityPct;
  if (Math.abs(probSum - 100) > 0.01) errors.push(`三情境機率加總為 ${probSum}，應為 100`);

  for (const key of ['bear', 'base', 'bull']) {
    const sc = s[key];
    const expected = round1(upsidePct(sc.targetPrice, v.currentPrice));
    if (Math.abs(expected - sc.impliedUpsidePct) > 0.6) errors.push(`scenarios.${key}.impliedUpsidePct=${sc.impliedUpsidePct}，依 currentPrice 應約為 ${expected}`);
    if (sc.targetMultiple != null && sc.method !== 'DCF') {
      const implied = sc.metricValue * sc.targetMultiple;
      if (Math.abs(implied - sc.targetPrice) / sc.targetPrice > 0.03) warnings.push(`scenarios.${key}：metricValue × targetMultiple = ${implied.toFixed(2)}，與 targetPrice ${sc.targetPrice} 差距 > 3%（若含淨現金等調整請在 formula 說明）`);
    }
  }

  const sc = v.streetConsensus;
  if (!(sc.lowTarget <= sc.medianTarget && sc.medianTarget <= sc.highTarget)) errors.push('streetConsensus 需滿足 low ≤ median ≤ high');

  const z = v.priceZones;
  if (!(z.cheap.max < z.fair.low && z.fair.low <= z.fair.high && z.fair.high < z.expensive.min)) errors.push('priceZones 需滿足 cheap.max < fair.low ≤ fair.high < expensive.min');
  for (const k of ['eps', 'pe', 'cagr']) {
    const b = z.sliderBounds[k];
    if (b.min >= b.max) errors.push(`priceZones.sliderBounds.${k} min 需小於 max`);
  }
  const inRange = (val, b) => val >= b.min && val <= b.max;
  if (!inRange(z.forwardEPS, z.sliderBounds.eps)) warnings.push('priceZones.forwardEPS 超出 sliderBounds.eps');
  if (!inRange(z.targetPE, z.sliderBounds.pe)) warnings.push('priceZones.targetPE 超出 sliderBounds.pe');
  if (!inRange(z.expectedCAGRPct, z.sliderBounds.cagr)) warnings.push('priceZones.expectedCAGRPct 超出 sliderBounds.cagr');

  const levelTypes = new Set(doc.technicals.keyLevels.map((l) => l.type));
  for (const t of KEY_LEVEL_TYPES) if (!levelTypes.has(t)) errors.push(`technicals.keyLevels 缺少 ${t}`);

  const cl = doc.changelog;
  if (cl[0].baseTargetTo !== s.base.targetPrice) errors.push(`changelog[0].baseTargetTo (${cl[0].baseTargetTo}) 必須等於 scenarios.base.targetPrice (${s.base.targetPrice})`);
  if (cl[0].ratingTo !== v.rating) errors.push(`changelog[0].ratingTo (${cl[0].ratingTo}) 必須等於 valuation.rating (${v.rating})`);
  if (cl[0].bearTarget !== s.bear.targetPrice || cl[0].bullTarget !== s.bull.targetPrice) errors.push('changelog[0] 的 bearTarget／bullTarget 必須等於本次 scenarios');
  for (let i = 1; i < cl.length; i++) {
    if (cl[i - 1].date < cl[i].date) errors.push(`changelog 必須由新到舊排列（第 ${i - 1} 與第 ${i} 筆）`);
    if (cl[i - 1].baseTargetFrom !== cl[i].baseTargetTo) warnings.push(`changelog[${i - 1}].baseTargetFrom (${cl[i - 1].baseTargetFrom}) 與前一版 changelog[${i}].baseTargetTo (${cl[i].baseTargetTo}) 不連續`);
  }
  if (cl.length > 1 && cl[0].baseTargetFrom == null) errors.push('非首次覆蓋時 changelog[0].baseTargetFrom 不可為 null');
  if (cl.length > 1 && !cl[0].previousThesis) errors.push('非首次覆蓋時 changelog[0].previousThesis 必須保留舊版核心觀點');

  const sourceIds = new Set(doc.meta.sources.map((x) => x.id));
  if (sourceIds.size !== doc.meta.sources.length) errors.push('meta.sources 的 id 重複');
  for (const n of doc.newsAndCatalysts.recentNews) {
    for (const id of n.sourceIds) if (!sourceIds.has(id)) errors.push(`recentNews「${n.headline.slice(0, 20)}…」引用不存在的來源 ${id}`);
  }
  const news = doc.newsAndCatalysts.recentNews;
  for (let i = 1; i < news.length; i++) if (news[i - 1].date < news[i].date) warnings.push('recentNews 建議由新到舊排列');

  const weights = doc.newsAndCatalysts.sentimentScore.components.reduce((a, c) => a + c.weightPct, 0);
  if (Math.abs(weights - 100) > 0.01) warnings.push(`sentimentScore.components 權重加總為 ${weights}，建議為 100`);

  const q = doc.fundamentals.financialMetrics.quarterly;
  for (let i = 1; i < q.length; i++) if (q[i - 1].periodEnd > q[i].periodEnd) errors.push('financialMetrics.quarterly 必須由舊到新排列');

  if (v.priceDate > doc.meta.dataAsOf) warnings.push('valuation.priceDate 晚於 meta.dataAsOf');
  return { errors, warnings };
}

// ---------- file IO ----------
async function listLocalTickers() {
  if (!existsSync(STOCKS_DIR)) return [];
  const files = await fs.readdir(STOCKS_DIR);
  return files.filter((f) => f.toLowerCase().endsWith('.json')).map((f) => f.replace(/\.json$/i, '').toUpperCase()).sort();
}

async function readStock(ticker) {
  const file = path.join(STOCKS_DIR, `${ticker}.json`);
  if (!existsSync(file)) throw new Error(`找不到 ${path.relative(ROOT, file)}`);
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

/** 驗證單一個股，回傳 doc 或 null */
async function validateStock(ticker, { quiet = false } = {}) {
  const validate = await getValidator();
  let doc;
  try {
    doc = await readStock(ticker);
  } catch (e) {
    fail(`${ticker}: ${e.message}`);
    return null;
  }
  return validateDoc(doc, ticker, validate, { quiet });
}

function validateDoc(doc, ticker, validate, { quiet = false } = {}) {
  if (!validate(doc)) {
    fail(`${ticker}: 不符合 Schema\n${formatAjvErrors(validate.errors)}`);
    return null;
  }
  const { errors, warnings } = consistencyCheck(doc, ticker);
  for (const w of warnings) warn(`${ticker}: ${w}`);
  if (errors.length) {
    fail(`${ticker}: 一致性檢查失敗\n${errors.map((e) => `    ${e}`).join('\n')}`);
    return null;
  }
  if (!quiet) ok(`${ticker} 通過 Schema 與一致性檢查 ${dim(`(updatedAt ${doc.valuation.updatedAt})`)}`);
  return doc;
}

function buildIndex(docs) {
  const stocks = docs
    .map((d) => {
      const v = d.valuation;
      return {
        ticker: v.ticker,
        exchange: v.exchange,
        name: v.name,
        nameZh: v.nameZh,
        sector: v.sector,
        industry: v.industry,
        rating: v.rating,
        currentPrice: v.currentPrice,
        priceDate: v.priceDate,
        bearTarget: v.scenarios.bear.targetPrice,
        baseTarget: v.scenarios.base.targetPrice,
        bullTarget: v.scenarios.bull.targetPrice,
        baseUpsidePct: round1(upsidePct(v.scenarios.base.targetPrice, v.currentPrice)),
        streetMedianTarget: v.streetConsensus.medianTarget,
        updatedAt: v.updatedAt,
        file: `stocks/${v.ticker}.json`,
      };
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  return {
    $schema: SCHEMA_REF_FROM_INDEX,
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    count: stocks.length,
    stocks,
  };
}

async function rebuildIndex({ dryRun = false } = {}) {
  const validate = await getValidator();
  const tickers = await listLocalTickers();
  const docs = [];
  for (const t of tickers) {
    const d = validateDoc(await readStock(t), t, validate, { quiet: true });
    if (!d) throw new Error(`${t} 驗證失敗，未重建 index.json`);
    docs.push(d);
  }
  const index = buildIndex(docs);
  if (!validate(index)) throw new Error(`index.json 不符合 Schema\n${formatAjvErrors(validate.errors)}`);
  if (dryRun) {
    console.log(dim(`[dry-run] 將寫入 data/index.json（${index.count} 檔）`));
  } else {
    await writeJson(INDEX_FILE, index);
    ok(`已重建 data/index.json（${index.count} 檔：${index.stocks.map((s) => s.ticker).join(', ') || '無'}）`);
  }
  return index;
}

// ---------- GAS API ----------
function gasConfig({ requireToken }) {
  const url = (process.env.VITE_GAS_API_URL || '').trim();
  const token = (process.env.GAS_SECRET_TOKEN || '').trim();
  if (!url) return null;
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) warn(`VITE_GAS_API_URL 看起來不是 Apps Script 網址：${url}`);
  if (requireToken && !token) throw new Error('.env 缺少 GAS_SECRET_TOKEN（請到 Apps Script 執行 showSecretToken() 取得）');
  return { url, token };
}

async function parseGasResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json && json.ok === false) throw new Error(`GAS 回應錯誤：${json.error || 'unknown'}`);
    return json;
  } catch (e) {
    if (e.message.startsWith('GAS 回應錯誤')) throw e;
    const hint = /<html|<!DOCTYPE/i.test(text)
      ? '收到 HTML 而非 JSON：請確認 Web App 部署的「誰可以存取」設為「任何人」，且網址是 /exec 結尾的最新部署。'
      : text.slice(0, 200);
    throw new Error(`無法解析 GAS 回應（HTTP ${res.status}）。${hint}`);
  }
}

async function gasPost(cfg, body) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, token: cfg.token }),
  });
  return parseGasResponse(res);
}

// ---------- commands ----------
async function cmdValidate(tickers, flags) {
  const list = tickers.length ? tickers : await listLocalTickers();
  if (!list.length) {
    warn('data/stocks/ 內沒有任何個股檔');
    return 0;
  }
  let bad = 0;
  for (const t of list) if (!(await validateStock(t, { quiet: flags.has('quiet') }))) bad++;

  if (existsSync(INDEX_FILE)) {
    const validate = await getValidator();
    const index = JSON.parse(await fs.readFile(INDEX_FILE, 'utf8'));
    if (!validate(index)) {
      fail(`data/index.json 不符合 Schema\n${formatAjvErrors(validate.errors)}`);
      bad++;
    } else {
      const local = new Set(await listLocalTickers());
      const indexed = new Set(index.stocks.map((s) => s.ticker));
      const missing = [...local].filter((t) => !indexed.has(t));
      const extra = [...indexed].filter((t) => !local.has(t));
      if (missing.length || extra.length) warn(`data/index.json 與個股檔不同步（缺：${missing.join(',') || '無'}；多：${extra.join(',') || '無'}），請執行 npm run sync:index`);
      else if (!flags.has('quiet')) ok('data/index.json 通過 Schema 檢查');
    }
  } else {
    warn('尚無 data/index.json，請執行 npm run sync:index');
  }
  if (bad) fail(`${bad} 個檔案驗證失敗`);
  else ok(`全部 ${list.length} 檔驗證通過`);
  return bad ? 1 : 0;
}

async function cmdPush(tickers, flags) {
  const dryRun = flags.has('dry-run');
  const list = tickers.length ? tickers : await listLocalTickers();
  if (!list.length) throw new Error('沒有可推送的個股檔');
  const docs = [];
  for (const t of list) {
    const d = await validateStock(t);
    if (!d) throw new Error(`${t} 未通過驗證，已中止推送（Google Sheets 未被修改）`);
    if (d.$schema !== SCHEMA_REF_FROM_STOCK) warn(`${t}: $schema 建議設為 ${SCHEMA_REF_FROM_STOCK}`);
    docs.push(d);
  }
  await rebuildIndex({ dryRun });

  const cfg = gasConfig({ requireToken: true });
  if (!cfg) {
    warn('.env 未設定 VITE_GAS_API_URL：僅完成本地驗證與 index.json 更新，未推送到 Google Sheets');
    return 0;
  }
  if (dryRun) {
    console.log(dim(`[dry-run] 將推送 ${docs.length} 檔到 ${cfg.url}`));
    return 0;
  }
  console.log(cyan(`→ 推送 ${docs.map((d) => d.valuation.ticker).join(', ')} 到 Google Sheets …`));
  const res = await gasPost(cfg, { action: 'upsert', stocks: docs });
  for (const r of res.results || []) {
    const tag = r.created ? '新增' : '更新';
    const cl = r.changelogAppended ? `，Changelog_History +${r.changelogAppended}` : '';
    const live = r.live && r.live.price ? `，即時價 $${r.live.price}` : '';
    ok(`${r.ticker} ${tag}於第 ${r.row} 列${cl}${live}`);
  }
  ok(`Google Sheets 同步完成（${res.spreadsheetUrl || 'spreadsheet'}）`);
  return 0;
}

async function cmdPull(tickers, flags) {
  const dryRun = flags.has('dry-run');
  const force = flags.has('force');
  const cfg = gasConfig({ requireToken: true });
  if (!cfg) throw new Error('.env 未設定 VITE_GAS_API_URL，無法從 Google Sheets 拉取');
  console.log(cyan('← 從 Google Sheets 拉取 Full_Analysis_JSON …'));
  // 以 POST 帶 Token（不放在 URL），即使 Web App 關閉公開讀取也能拉取
  const res = await gasPost(cfg, { action: 'export' });
  const remote = (res.stocks || []).filter((s) => s.analysis);
  const wanted = new Set(tickers);
  const validate = await getValidator();
  let written = 0, skipped = 0, invalid = 0;

  for (const item of remote) {
    const ticker = normTicker(item.ticker || item.analysis.valuation?.ticker);
    if (wanted.size && !wanted.has(ticker)) continue;
    const doc = item.analysis;
    if (!validateDoc(doc, ticker, validate, { quiet: true })) {
      invalid++;
      continue;
    }
    const file = path.join(STOCKS_DIR, `${ticker}.json`);
    if (existsSync(file) && !force) {
      const local = JSON.parse(await fs.readFile(file, 'utf8'));
      const lt = Date.parse(local?.valuation?.updatedAt || 0);
      const rt = Date.parse(doc.valuation.updatedAt);
      if (lt > rt) {
        warn(`${ticker}: 本地版本較新（${local.valuation.updatedAt} > ${doc.valuation.updatedAt}），保留本地；如要覆寫請加 --force`);
        skipped++;
        continue;
      }
      if (lt === rt) {
        console.log(dim(`  ${ticker}: 已是最新`));
        skipped++;
        continue;
      }
    }
    doc.$schema = SCHEMA_REF_FROM_STOCK;
    if (dryRun) console.log(dim(`[dry-run] 將寫入 data/stocks/${ticker}.json`));
    else await writeJson(file, doc);
    ok(`${ticker} ← Google Sheets（updatedAt ${doc.valuation.updatedAt}）`);
    written++;
  }
  if (written && !dryRun) await rebuildIndex();
  console.log(`完成：寫入 ${written}、略過 ${skipped}、無效 ${invalid}（雲端共 ${remote.length} 檔）`);
  if (written && !dryRun) console.log(dim('提示：如需讓 GitHub 也同步，請 git add data && git commit && git push'));
  return invalid ? 1 : 0;
}

async function cmdPing() {
  const cfg = gasConfig({ requireToken: true });
  if (!cfg) throw new Error('.env 未設定 VITE_GAS_API_URL');
  const res = await gasPost(cfg, { action: 'ping' });
  ok(`連線成功：${res.spreadsheetName || ''} ${dim(res.spreadsheetUrl || '')}`);
  console.log(`  已追蹤 ${res.count ?? '?'} 檔；Token 驗證${res.authorized ? green('通過') : red('失敗')}`);
  return res.authorized ? 0 : 1;
}

async function main() {
  loadEnv();
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  const tickers = positional.map(normTicker);
  switch (cmd) {
    case 'validate': return cmdValidate(tickers, flags);
    case 'index': await rebuildIndex({ dryRun: flags.has('dry-run') }); return 0;
    case 'push': return cmdPush(tickers, flags);
    case 'pull': return cmdPull(tickers, flags);
    case 'ping': return cmdPing();
    default:
      console.log('用法：node scripts/sync.mjs <validate|index|push|pull|ping> [TICKER...] [--dry-run] [--force]');
      return cmd ? 1 : 0;
  }
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((e) => {
    fail(e.message);
    process.exit(1);
  });
