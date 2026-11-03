/**
 * 美股深度分析 — Google Sheets 雲端後端（Google Apps Script）
 *
 * 使用方式（詳見 SETUP_GUIDE.md）：
 *   1. 在 Google Sheets「擴充功能 → Apps Script」貼上本檔全部內容並儲存。
 *   2. 在編輯器上方選擇函式 setupSheet 執行一次（首次會要求授權）→ 建立工作表並產生 SECRET_TOKEN。
 *   3. 執行 showSecretToken 取得 Token，填入本機 .env 的 GAS_SECRET_TOKEN。
 *   4. 「部署 → 新增部署作業 → 網頁應用程式」：執行身分＝我、誰可以存取＝任何人；
 *      複製 /exec 網址填入 .env 的 VITE_GAS_API_URL。
 *
 * API：
 *   GET  ?action=list[&ticker=MRVL]   完整分析 JSON + GOOGLEFINANCE 即時報價（公開讀取，可用 setPublicRead(false) 關閉）
 *   GET  ?action=quotes               只回傳即時報價（網站定時刷新用，輕量）
 *   GET  ?action=ping                 健康檢查
 *   GET  ...&callback=fn              JSONP（CORS 受限環境的備援）
 *   POST {token, action:"upsert", stocks:[...]}   新增／更新一或多檔，並自動寫入 Changelog_History
 *   POST {token, action:"export"}                  以 Token 匯出全部（sync:pull 使用）
 *   POST {token, action:"delete", tickers:[...]}   刪除
 *   POST {token, action:"ping"}                    驗證 Token
 */

const CONFIG = {
  INDEX_SHEET: 'US_Stocks_Index',
  CHANGELOG_SHEET: 'Changelog_History',
  OVERFLOW_SHEET: '_JSON_Overflow',
  CELL_CHUNK: 45000, // Google Sheets 單一儲存格上限 50,000 字元，保留餘裕
  TOKEN_PROPERTY: 'SECRET_TOKEN',
  PUBLIC_READ_PROPERTY: 'PUBLIC_READ',
  SCHEMA_VERSION: '1.0.0',
};

const INDEX_HEADERS = [
  'Ticker', 'Exchange', 'Name', 'Sector',
  'Live_Price', 'Change_Pct', 'Market_Cap', 'High_52W', 'Low_52W',
  'Rating', 'Bear_Target', 'Base_Target', 'Bull_Target', 'Street_Median_Target',
  'Live_Upside_Pct', 'Updated_At', 'Full_Analysis_JSON',
];

const CHANGELOG_HEADERS = [
  'Timestamp', 'Ticker', 'Price_At_Update', 'Old_Base_Target', 'New_Base_Target', 'Summary', 'Rating_Change', 'Entry_Key',
];

const OVERFLOW_HEADERS = ['Ticker', 'Part', 'Data'];
const OVERFLOW_PREFIX = '~';

/** 欄位名稱 → 欄號（1-based） */
const COL = INDEX_HEADERS.reduce(function (acc, h, i) { acc[h] = i + 1; return acc; }, {});

const VALID_EXCHANGES = ['NASDAQ', 'NYSE'];
const VALID_RATINGS = ['Strong Buy', 'Buy', 'Hold', 'Trim'];

// =====================================================================
// 選單與初始化
// =====================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📈 美股分析')
    .addItem('初始化／修復工作表', 'setupSheet')
    .addItem('重建即時報價公式', 'refreshFormulas')
    .addSeparator()
    .addItem('顯示 Secret Token', 'showSecretToken')
    .addItem('重新產生 Secret Token', 'rotateSecretToken')
    .addToUi();
}

/**
 * 自動初始化：建立 US_Stocks_Index、Changelog_History 與隱藏的 _JSON_Overflow，
 * 設定標題、格式、凍結列、條件式格式，並確保 SECRET_TOKEN 存在。可重複執行（不會刪除資料）。
 */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- US_Stocks_Index ----
  const index = getOrCreateSheet_(ss, CONFIG.INDEX_SHEET);
  writeHeaders_(index, INDEX_HEADERS);
  index.setFrozenRows(1);
  index.setFrozenColumns(1);
  const widths = {
    Ticker: 80, Exchange: 80, Name: 220, Sector: 170, Live_Price: 95, Change_Pct: 90, Market_Cap: 110,
    High_52W: 90, Low_52W: 90, Rating: 90, Bear_Target: 95, Base_Target: 95, Bull_Target: 95,
    Street_Median_Target: 140, Live_Upside_Pct: 120, Updated_At: 200, Full_Analysis_JSON: 320,
  };
  Object.keys(widths).forEach(function (h) { index.setColumnWidth(COL[h], widths[h]); });
  applyIndexFormats_(index);
  applyIndexConditionalFormats_(index);

  // ---- Changelog_History ----
  const log = getOrCreateSheet_(ss, CONFIG.CHANGELOG_SHEET);
  writeHeaders_(log, CHANGELOG_HEADERS);
  log.setFrozenRows(1);
  [170, 80, 120, 130, 130, 520, 150, 260].forEach(function (w, i) { log.setColumnWidth(i + 1, w); });
  const logRows = Math.max(log.getMaxRows() - 1, 1);
  log.getRange(2, 1, logRows, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  log.getRange(2, 3, logRows, 3).setNumberFormat('$#,##0.00');
  log.getRange(2, 6, logRows, 1).setWrap(true);
  log.getRange(2, 8, logRows, 1).setFontColor('#9aa0a6');

  // ---- _JSON_Overflow（超過單格上限的 JSON 片段）----
  const overflow = getOrCreateSheet_(ss, CONFIG.OVERFLOW_SHEET);
  writeHeaders_(overflow, OVERFLOW_HEADERS);
  overflow.hideSheet();

  // 移除空白的預設工作表
  ss.getSheets().forEach(function (sh) {
    const name = sh.getName();
    if ((name === 'Sheet1' || name === '工作表1') && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  const token = ensureToken_();
  refreshFormulas();
  ss.setActiveSheet(index);

  const msg = '初始化完成。\n\nSECRET_TOKEN：\n' + token + '\n\n請填入本機 .env 的 GAS_SECRET_TOKEN，並將此專案部署為網頁應用程式（誰可以存取：任何人）。';
  Logger.log(msg);
  safeAlert_(msg);
  return msg;
}

/** 為每一列重寫 GOOGLEFINANCE 與即時潛在空間公式（新增欄位或公式被誤刪時使用） */
function refreshFormulas() {
  const sheet = getSheet_(CONFIG.INDEX_SHEET);
  const last = sheet.getLastRow();
  for (let r = 2; r <= last; r++) {
    if (String(sheet.getRange(r, COL.Ticker).getValue()).trim()) writeRowFormulas_(sheet, r);
  }
  SpreadsheetApp.flush();
}

// =====================================================================
// Token 管理
// =====================================================================

function ensureToken_() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty(CONFIG.TOKEN_PROPERTY);
  if (!token) {
    token = generateToken_();
    props.setProperty(CONFIG.TOKEN_PROPERTY, token);
  }
  return token;
}

function generateToken_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

function showSecretToken() {
  const token = ensureToken_();
  Logger.log('SECRET_TOKEN = ' + token);
  safeAlert_('SECRET_TOKEN：\n' + token + '\n\n填入 .env：GAS_SECRET_TOKEN=' + token);
  return token;
}

function rotateSecretToken() {
  const token = generateToken_();
  PropertiesService.getScriptProperties().setProperty(CONFIG.TOKEN_PROPERTY, token);
  Logger.log('新的 SECRET_TOKEN = ' + token);
  safeAlert_('已產生新的 SECRET_TOKEN（舊 Token 立即失效）：\n' + token + '\n\n請更新每台電腦的 .env。');
  return token;
}

/** 關閉／開啟公開讀取（關閉後網站無法匿名讀取即時報價，sync:pull 仍可用 Token） */
function setPublicRead(enabled) {
  PropertiesService.getScriptProperties().setProperty(CONFIG.PUBLIC_READ_PROPERTY, enabled === false ? 'false' : 'true');
  return isPublicRead_();
}

function isPublicRead_() {
  return PropertiesService.getScriptProperties().getProperty(CONFIG.PUBLIC_READ_PROPERTY) !== 'false';
}

function checkToken_(candidate) {
  const token = PropertiesService.getScriptProperties().getProperty(CONFIG.TOKEN_PROPERTY);
  if (!token || typeof candidate !== 'string' || candidate.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ candidate.charCodeAt(i);
  return diff === 0;
}

// =====================================================================
// REST API
// =====================================================================

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'list').toLowerCase();
  const callback = p.callback;
  try {
    if (action === 'ping') return output_({ ok: true, service: 'us-stock-analysis', schemaVersion: CONFIG.SCHEMA_VERSION, time: new Date().toISOString() }, callback);
    if (!isPublicRead_() && !checkToken_(p.token)) return output_({ ok: false, error: 'unauthorized' }, callback);

    const includeAnalysis = action !== 'quotes';
    let stocks = readAll_({ includeAnalysis: includeAnalysis });
    if (p.ticker) {
      const wanted = String(p.ticker).toUpperCase().split(',');
      stocks = stocks.filter(function (s) { return wanted.indexOf(s.ticker) >= 0; });
    }
    return output_({ ok: true, generatedAt: new Date().toISOString(), count: stocks.length, stocks: stocks }, callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) }, callback);
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return output_({ ok: false, error: 'invalid JSON body' });
  }
  if (!checkToken_(body.token)) return output_({ ok: false, error: 'unauthorized' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = String(body.action || 'upsert').toLowerCase();
  const lock = LockService.getScriptLock();
  try {
    if (action === 'ping') {
      return output_({ ok: true, authorized: true, spreadsheetName: ss.getName(), spreadsheetUrl: ss.getUrl(), count: readAll_({ includeAnalysis: false }).length });
    }
    if (action === 'export') {
      const stocks = readAll_({ includeAnalysis: true });
      return output_({ ok: true, generatedAt: new Date().toISOString(), count: stocks.length, stocks: stocks });
    }

    lock.waitLock(30000);
    ensureSheetsExist_();

    if (action === 'delete') {
      const tickers = (body.tickers || []).map(function (t) { return String(t).toUpperCase(); });
      const deleted = tickers.filter(deleteTicker_);
      return output_({ ok: true, deleted: deleted });
    }

    if (action === 'upsert') {
      const stocks = Array.isArray(body.stocks) ? body.stocks : (body.stock ? [body.stock] : []);
      if (!stocks.length) return output_({ ok: false, error: 'no stocks in payload' });
      const ctx = { changelogKeys: readChangelogKeys_() };
      const results = stocks.map(function (doc) { return upsertStock_(doc, ctx); });
      SpreadsheetApp.flush();
      const live = indexLiveByTicker_();
      results.forEach(function (r) { r.live = live[r.ticker] || null; });
      return output_({ ok: true, results: results, spreadsheetUrl: ss.getUrl() });
    }

    return output_({ ok: false, error: 'unknown action: ' + action });
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* lock 未取得 */ }
  }
}

// =====================================================================
// 寫入
// =====================================================================

function upsertStock_(doc, ctx) {
  assertMinimalShape_(doc);
  const v = doc.valuation;
  const ticker = v.ticker.toUpperCase();
  const sheet = getSheet_(CONFIG.INDEX_SHEET);

  let row = findRow_(sheet, ticker);
  const created = row < 0;
  if (created) row = Math.max(sheet.getLastRow() + 1, 2);

  const oldBase = created ? null : num_(sheet.getRange(row, COL.Base_Target).getValue());
  const oldRating = created ? null : String(sheet.getRange(row, COL.Rating).getValue() || '') || null;

  const json = JSON.stringify(doc);
  const chunks = chunkString_(json, CONFIG.CELL_CHUNK);

  sheet.getRange(row, COL.Ticker, 1, 4).setValues([[ticker, v.exchange, v.name, v.sector]]);
  sheet.getRange(row, COL.Rating, 1, 5).setValues([[
    v.rating,
    v.scenarios.bear.targetPrice,
    v.scenarios.base.targetPrice,
    v.scenarios.bull.targetPrice,
    v.streetConsensus.medianTarget,
  ]]);
  sheet.getRange(row, COL.Updated_At).setNumberFormat('@').setValue(v.updatedAt);
  sheet.getRange(row, COL.Full_Analysis_JSON).setNumberFormat('@').setValue(chunks[0]);
  writeOverflow_(ticker, chunks.slice(1));
  writeRowFormulas_(sheet, row);

  const appended = appendChangelog_(ticker, doc, oldBase, oldRating, ctx);
  return { ticker: ticker, row: row, created: created, jsonChars: json.length, overflowParts: chunks.length - 1, changelogAppended: appended };
}

function assertMinimalShape_(doc) {
  if (!doc || typeof doc !== 'object' || !doc.valuation) throw new Error('payload 缺少 valuation');
  const v = doc.valuation;
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(String(v.ticker || ''))) throw new Error('valuation.ticker 格式錯誤：' + v.ticker);
  if (VALID_EXCHANGES.indexOf(v.exchange) < 0) throw new Error(v.ticker + ': exchange 必須是 NASDAQ 或 NYSE');
  if (VALID_RATINGS.indexOf(v.rating) < 0) throw new Error(v.ticker + ': rating 不合法');
  ['bear', 'base', 'bull'].forEach(function (k) {
    if (!v.scenarios || !v.scenarios[k] || typeof v.scenarios[k].targetPrice !== 'number') throw new Error(v.ticker + ': scenarios.' + k + '.targetPrice 缺漏');
  });
  if (!v.streetConsensus || typeof v.streetConsensus.medianTarget !== 'number') throw new Error(v.ticker + ': streetConsensus.medianTarget 缺漏');
  if (!Array.isArray(doc.changelog) || !doc.changelog.length) throw new Error(v.ticker + ': changelog 至少需要一筆');
}

function writeRowFormulas_(sheet, r) {
  const id = '$B' + r + '&":"&$A' + r;
  sheet.getRange(r, COL.Live_Price, 1, 5).setFormulas([[
    '=IFERROR(GOOGLEFINANCE(' + id + ', "price"), "")',
    '=IFERROR(GOOGLEFINANCE(' + id + ', "changepct"), "")',
    '=IFERROR(GOOGLEFINANCE(' + id + ', "marketcap"), "")',
    '=IFERROR(GOOGLEFINANCE(' + id + ', "high52"), "")',
    '=IFERROR(GOOGLEFINANCE(' + id + ', "low52"), "")',
  ]]);
  sheet.getRange(r, COL.Live_Upside_Pct).setFormula('=IF(OR($E' + r + '="", $L' + r + '=""), "", ($L' + r + '-$E' + r + ')/$E' + r + ')');
}

function writeOverflow_(ticker, parts) {
  const sheet = getSheet_(CONFIG.OVERFLOW_SHEET);
  const last = sheet.getLastRow();
  if (last >= 2) {
    const tickers = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (let i = tickers.length - 1; i >= 0; i--) {
      if (String(tickers[i][0]).toUpperCase() === ticker) sheet.deleteRow(i + 2);
    }
  }
  if (!parts.length) return;
  // 片段開頭可能是 = + - @，加上「~」避免被 Sheets 當成公式；讀取時移除
  const rows = parts.map(function (p, i) { return [ticker, i + 2, OVERFLOW_PREFIX + p]; });
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 3, rows.length, 1).setNumberFormat('@');
  sheet.getRange(start, 1, rows.length, 3).setValues(rows);
}

/**
 * 將 doc.changelog 中尚未記錄的項目寫入 Changelog_History（以 Entry_Key 去重，重複推送不會重複寫入）。
 * 若 Base_Target 被改動卻沒有新的 changelog 項目，也會補記一筆自動紀錄。
 */
function appendChangelog_(ticker, doc, oldBase, oldRating, ctx) {
  const sheet = getSheet_(CONFIG.CHANGELOG_SHEET);
  const keys = ctx.changelogKeys;
  const entries = doc.changelog.slice().reverse(); // 由舊到新寫入
  const latest = doc.changelog[0];
  const rows = [];

  entries.forEach(function (c) {
    const key = [ticker, c.date, c.baseTargetTo, c.ratingTo].join('|');
    if (keys[key]) return;
    keys[key] = true;
    const ts = c === latest ? new Date() : parseDate_(c.date);
    const ratingChange = (c.ratingFrom ? c.ratingFrom : '首次覆蓋') + ' → ' + c.ratingTo;
    rows.push([ts, ticker, c.priceAtUpdate, c.baseTargetFrom == null ? '' : c.baseTargetFrom, c.baseTargetTo, c.summary, ratingChange, key]);
  });

  const newBase = doc.valuation.scenarios.base.targetPrice;
  if (!rows.length && oldBase != null && oldBase !== newBase) {
    const key = [ticker, new Date().toISOString(), newBase, doc.valuation.rating].join('|');
    rows.push([new Date(), ticker, doc.valuation.currentPrice, oldBase, newBase, '（自動紀錄）Base_Target 變動但 JSON 未新增 changelog 項目', (oldRating || '?') + ' → ' + doc.valuation.rating, key]);
  }

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CHANGELOG_HEADERS.length).setValues(rows);
  return rows.length;
}

function readChangelogKeys_() {
  const sheet = getSheet_(CONFIG.CHANGELOG_SHEET);
  const last = sheet.getLastRow();
  const keys = {};
  if (last < 2) return keys;
  sheet.getRange(2, CHANGELOG_HEADERS.indexOf('Entry_Key') + 1, last - 1, 1).getValues().forEach(function (r) {
    if (r[0]) keys[String(r[0])] = true;
  });
  return keys;
}

function deleteTicker_(ticker) {
  const sheet = getSheet_(CONFIG.INDEX_SHEET);
  const row = findRow_(sheet, ticker);
  if (row < 0) return false;
  sheet.deleteRow(row);
  writeOverflow_(ticker, []);
  return true;
}

// =====================================================================
// 讀取
// =====================================================================

function readAll_(opts) {
  const sheet = getSheet_(CONFIG.INDEX_SHEET);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, INDEX_HEADERS.length).getValues();
  const overflow = opts.includeAnalysis ? readOverflow_() : {};
  const out = [];

  values.forEach(function (row) {
    const get = function (h) { return row[COL[h] - 1]; };
    const ticker = String(get('Ticker') || '').trim().toUpperCase();
    if (!ticker) return;
    const price = num_(get('Live_Price'));
    const base = num_(get('Base_Target'));
    const item = {
      ticker: ticker,
      exchange: String(get('Exchange') || ''),
      name: String(get('Name') || ''),
      sector: String(get('Sector') || ''),
      rating: String(get('Rating') || ''),
      bearTarget: num_(get('Bear_Target')),
      baseTarget: base,
      bullTarget: num_(get('Bull_Target')),
      streetMedianTarget: num_(get('Street_Median_Target')),
      updatedAt: String(get('Updated_At') || ''),
      live: {
        price: price,
        changePct: num_(get('Change_Pct')),
        marketCap: num_(get('Market_Cap')),
        high52w: num_(get('High_52W')),
        low52w: num_(get('Low_52W')),
        upsidePct: price && base ? round2_(((base - price) / price) * 100) : null,
        asOf: new Date().toISOString(),
        source: 'GOOGLEFINANCE',
      },
    };
    if (opts.includeAnalysis) {
      const raw = String(get('Full_Analysis_JSON') || '') + (overflow[ticker] || []).join('');
      try {
        item.analysis = raw ? JSON.parse(raw) : null;
      } catch (err) {
        item.analysis = null;
        item.error = 'Full_Analysis_JSON 解析失敗：' + err;
      }
    }
    out.push(item);
  });
  return out;
}

function readOverflow_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.OVERFLOW_SHEET);
  const map = {};
  if (!sheet || sheet.getLastRow() < 2) return map;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
    .sort(function (a, b) { return Number(a[1]) - Number(b[1]); })
    .forEach(function (r) {
      const t = String(r[0]).toUpperCase();
      const s = String(r[2]);
      (map[t] = map[t] || []).push(s.charAt(0) === OVERFLOW_PREFIX ? s.slice(1) : s);
    });
  return map;
}

function indexLiveByTicker_() {
  const map = {};
  readAll_({ includeAnalysis: false }).forEach(function (s) { map[s.ticker] = s.live; });
  return map;
}

// =====================================================================
// 工具函式
// =====================================================================

function output_(obj, callback) {
  const text = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$.]{0,63}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + text + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('找不到工作表 ' + name + '，請先執行 setupSheet()');
  return sheet;
}

function ensureSheetsExist_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(CONFIG.INDEX_SHEET) || !ss.getSheetByName(CONFIG.CHANGELOG_SHEET) || !ss.getSheetByName(CONFIG.OVERFLOW_SHEET)) setupSheet();
}

function writeHeaders_(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setFontColor('#f5f5f4')
    .setBackground('#111827')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 30);
}

function applyIndexFormats_(sheet) {
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const money = '$#,##0.00';
  ['Live_Price', 'High_52W', 'Low_52W', 'Bear_Target', 'Base_Target', 'Bull_Target', 'Street_Median_Target'].forEach(function (h) {
    sheet.getRange(2, COL[h], rows, 1).setNumberFormat(money);
  });
  sheet.getRange(2, COL.Change_Pct, rows, 1).setNumberFormat('+0.00"%";-0.00"%";0.00"%"');
  sheet.getRange(2, COL.Market_Cap, rows, 1).setNumberFormat('$#,##0.0,,,"B"');
  sheet.getRange(2, COL.Live_Upside_Pct, rows, 1).setNumberFormat('+0.0%;-0.0%;0.0%');
  sheet.getRange(2, COL.Updated_At, rows, 1).setNumberFormat('@');
  sheet.getRange(2, COL.Full_Analysis_JSON, rows, 1).setNumberFormat('@').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor('#9aa0a6');
  sheet.getRange(2, COL.Ticker, rows, 1).setFontWeight('bold');
}

function applyIndexConditionalFormats_(sheet) {
  const rows = Math.max(sheet.getMaxRows() - 1, 1);
  const change = sheet.getRange(2, COL.Change_Pct, rows, 1);
  const upside = sheet.getRange(2, COL.Live_Upside_Pct, rows, 1);
  const rating = sheet.getRange(2, COL.Rating, rows, 1);
  const rules = sheet.getConditionalFormatRules().filter(function (rule) {
    // 移除本函式先前建立的規則，避免重複
    return !rule.getRanges().some(function (r) {
      const c = r.getColumn();
      return c === COL.Change_Pct || c === COL.Live_Upside_Pct || c === COL.Rating;
    });
  });
  const green = '#0f7b0f', red = '#c62828';
  rules.push(
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setFontColor(green).setRanges([change, upside]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor(red).setRanges([change, upside]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Strong Buy').setBackground('#d1fae5').setRanges([rating]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Buy').setBackground('#e0f2fe').setRanges([rating]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Hold').setBackground('#f3f4f6').setRanges([rating]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Trim').setBackground('#fee2e2').setRanges([rating]).build()
  );
  sheet.setConditionalFormatRules(rules);
}

function findRow_(sheet, ticker) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const col = sheet.getRange(2, COL.Ticker, last - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toUpperCase() === ticker) return i + 2;
  }
  return -1;
}

function chunkString_(s, size) {
  const out = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [''];
}

/** GOOGLEFINANCE 載入中、#N/A 或空字串都視為 null */
function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,%\s]/g, ''));
  return isFinite(n) ? n : null;
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function parseDate_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

function safeAlert_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (ignore) {
    // 由 Web App 或觸發器呼叫時沒有 UI，改看執行紀錄
  }
}
