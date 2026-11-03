# 美股深度分析專案 — AI 跨電腦標準作業流程（SOP）

本檔是 Claude Code 在此專案的**強制作業規範**。使用者在任何一台電腦下達「新增美股 [TICKER]」或「更新美股 [TICKER]」時，必須完整依照下方四個步驟執行，確保每一檔股票、每一次更新的結構與標準 100% 一致。

- 溝通語言：繁體中文；程式碼、識別字、commit message 用英文。
- 介面與分析文字：繁體中文；專有名詞保留英文縮寫（Non-GAAP EPS、FCF、EV/EBITDA、Forward P/E、PEG、SBC、ROIC、13F、Form 4、Short Interest、Put/Call Ratio、Max Pain、Gamma、VWAP、SMA、RSI、MACD、Beat/Miss、Guidance）。
- 本網站內容是研究整理，不是投資建議；分析文字避免「建議你買」之類的個人化措辭，改用「模型顯示」「評等為」等研究語氣。

## 專案結構

```
schema/stock-analysis.schema.json   唯一資料規格（個股檔與索引檔共用）
data/stocks/{TICKER}.json            個股完整分析（唯一真實來源，GitHub 備份）
data/index.json                      由腳本自動產生，勿手動編輯
gas/Code.gs                          Google Sheets 後端（Apps Script Web App）
scripts/sync.mjs                     validate / index / push / pull / ping
scripts/market-data.mjs              技術面＋選擇權＋空單數據計算器（統一口徑）
src/                                 Vite + React + Tailwind 網站
.github/workflows/deploy.yml         push main → 驗證 → 建置 → GitHub Pages
```

## 指令速查

| 指令 | 用途 |
|---|---|
| `npm run validate` | Schema + 跨欄位一致性檢查（`npm run build` 會自動先跑） |
| `npm run market-data -- TICKER --sector SMH --peers AVGO,NVDA` | 取得統一口徑的技術／籌碼數據 |
| `npm run sync:index` | 重建 `data/index.json` |
| `npm run sync:push TICKER` | 驗證 → 重建索引 → 推送 Google Sheets（寫入 Changelog_History） |
| `npm run sync:pull` | 從 Google Sheets 拉回所有 `Full_Analysis_JSON`（本地較新者保留，`-- --force` 強制覆寫） |
| `npm run sync:ping` | 測試 GAS 連線與 Token |
| `npm run dev` / `npm run build` / `npm run preview` | 開發／建置／預覽 |

Windows 注意：Node 若是可攜版，路徑為 `%LOCALAPPDATA%\Programs\nodejs`；PowerShell 中若找不到 npm，先執行 `$env:Path = "$env:LOCALAPPDATA\Programs\nodejs;$env:Path"`。

---

## 「新增美股 [TICKER]」／「更新美股 [TICKER]」四步驟

### Step 1 — 同步最新狀態（不可省略）

1. 若此資料夾是 git repo 且有 remote：先 `git status` 確認沒有未提交的本地修改，再 `git pull --rebase`。有衝突時停下來問使用者。
2. 若 `.env` 有 `VITE_GAS_API_URL`：執行 `npm run sync:pull`。若輸出顯示「本地版本較新」，代表另一台電腦尚未推送或本機有未推送更新——向使用者說明後再決定是否 `--force`。
3. 讀取現有的 `data/stocks/{TICKER}.json`（若存在）。**更新時必須先記下舊版的 `valuation.rating`、三情境目標價、`ratingRationale` 與 `sentimentScore.verdict`**，Step 3 要寫入 changelog。

### Step 2 — 深度聯網研究

先跑計算器取得技術與籌碼數據（數字直接引用，不要自己估）：

```bash
npm run market-data -- TICKER --sector <產業ETF> --peers <同業1,同業2> --out tmp/TICKER-market.json
```

產業 ETF 對照：半導體 `SMH`、軟體 `IGV`、網路 `FDN`、金融 `XLF`、醫療 `XLV`、能源 `XLE`、消費 `XLY`、工業 `XLI`、通訊 `XLC`。`tmp/` 不納入版控。

接著用 WebSearch／WebFetch（被擋時改用瀏覽器面板）逐項查證，**每一項都要有可引用的來源**，並登錄到 `meta.sources`（`S1`、`S2`…）：

| 項目 | 優先來源 |
|---|---|
| 最新一季財報（10-Q/10-K、8-K Ex.99.1）：Revenue、Non-GAAP EPS、GM、OPM、OCF、CapEx、FCF、SBC、回購、現金與負債、部門營收 | SEC EDGAR 原始 8-K／10-Q、公司 IR 新聞稿 |
| Beat/Miss：營收與 EPS 的市場共識 | FactSet／LSEG 報導（財經新聞引用）、Earnings Whispers |
| Earnings Call 管理層 Forward Guidance、全年展望、問答重點 | 逐字稿（Seeking Alpha、Benzinga、Motley Fool 等）、公司簡報 |
| 華爾街共識目標價 Low／Median／Mean／High、評等家數、最近 2 週調整 | StockAnalysis.com forecast、TipRanks、MarketBeat |
| 13F 機構持倉、主要持有人加減碼 | 13F 彙整網站、SEC 13F |
| 內部人 Form 4（日期、身分、股數、價格、是否 10b5-1） | SEC EDGAR Form 4、InsiderTrades／OpenInsider |
| Short Interest % of Float、Days to Cover | `market-data` 輸出（Nasdaq 半月結算） |
| Put/Call、Max Pain、Gamma、IV30 | `market-data` 輸出 + Market Chameleon（IV30） |
| 20/50/200 SMA、VWAP、RSI、MACD、52 週高低、相對強弱 | `market-data` 輸出 |
| 近期重大新聞、8-K、併購、分析師升降評 | 主流財經媒體（Reuters、CNBC、Bloomberg 轉載）、SEC 8-K |
| 未來 1~4 季催化劑：下次財報日、大型展會（GTC、CES、re:Invent、Computex…）、新品量產、雲端 CapEx 指引、FOMC | 公司 IR 行事曆、聯準會官方行事曆、展會官網 |

研究紀律：
- 查不到或來源互相矛盾的數字 → 填 `null`（Schema 允許的欄位）並在 `meta.dataQualityNotes` 說明，**絕不捏造**。
- 自行估算的數字（ROIC、Gamma、浮動股數）→ 在 `basis`／`comment`／`dataQualityNotes` 標明「我方估算」與算法。
- 日期未公布的催化劑 → `dateConfirmed: false`，`window` 寫「（預估）」並附上推估依據（例如「去年為 12/2」）。
- 會計年度與日曆年不同的公司 → `valuation.fiscalYearNote` 必須寫清楚對照。

### Step 3 — 寫入結構化資料與 Changelog

嚴格依照 `schema/stock-analysis.schema.json` 寫入 `data/stocks/{TICKER}.json`（`$schema` 設為 `../../schema/stock-analysis.schema.json`）。

**更新既有股票時的 changelog 規則（最重要）：**
1. `changelog` 由新到舊排列。在陣列**最前面插入**一筆新紀錄，保留所有舊紀錄不得刪改。
2. 新紀錄：`date`＝今天、`priceAtUpdate`＝本次 `currentPrice`、`ratingFrom`＝舊評等、`ratingTo`＝新評等、`baseTargetFrom`＝舊 base 目標價、`baseTargetTo`／`bearTarget`／`bullTarget`＝本次三情境、`previousThesis`＝舊版 `ratingRationale` 的精簡摘要（必填，不可為 null）、`summary`＝本次核心觀點變化、`keyChanges`＝具體變動條列（例如「Base $216 → $240：FY2028E EPS $7.20 → $7.80」）。
3. 新增股票時只有一筆，`ratingFrom`、`baseTargetFrom`、`previousThesis` 為 `null`。

**數值慣例：**
- 名稱以 `Pct` 結尾的欄位一律是「百分點」（26.5 代表 26.5%）；以 `USDm` 結尾者為百萬美元；`financialMetrics` 內金額單位 `USD M`。
- `impliedUpsidePct`＝（目標價 − currentPrice）÷ currentPrice × 100，四捨五入到小數一位（validate 會檢查 ±0.6）。
- `updatedAt` 用含時區的 ISO 8601（台灣：`+08:00`）；其餘日期用 `YYYY-MM-DD`。
- 排序：`financialMetrics.quarterly` 由舊到新（指引季放最後並設 `isEstimate: true`）；`recentNews` 由新到舊；`catalystTimeline` 由近到遠。

**估值方法標準：**
- 三情境都要有可重算的 `formula`（例如 `FY2028E Non-GAAP EPS $7.20 × 30x = $216`），`metricValue × targetMultiple` 與 `targetPrice` 差距 > 3% 時必須在 formula 說明調整項（淨現金、稀釋等）。
- 預設方法：獲利穩定的成長股用 Forward P/E（以「12 個月後市場會看的會計年度」為基準）；高成長未獲利用 EV/Sales 或 P/FCF；成熟現金流公司用 DCF 或 P/FCF；週期股用 EV/EBITDA（取循環中段）。同一檔股票三情境使用同一種方法，除非在 `thesis` 說明理由。
- 機率加總 100，預設 25／50／25；有重大二元事件時可調整並說明。
- `priceZones`：以 base 情境的 EPS（或對應指標）× 倍數帶推導，`cheap.max < fair.low ≤ fair.high < expensive.min`，並在 `methodology` 寫出倍數與技術面依據；`forwardEPS`／`targetPE`／`expectedCAGRPct`／`pegTarget` 必須與 base 情境一致，`sliderBounds` 要涵蓋 bear 到 bull 的範圍。

**評等定義（以分析日 base 隱含漲跌幅為主，再依風險調整一級）：**

| 評等 | 條件 |
|---|---|
| Strong Buy | base ≥ +30% 且機率加權 ≥ +25%，且沒有重大未決事件風險 |
| Buy | base +15% ~ +30%，或 base ≥ +30% 但有重大事件／稀釋／監管風險 |
| Hold | base −5% ~ +15% |
| Trim | base < −5%，或估值位於 `expensive` 區且動能轉弱 |

**情緒評分（sentimentScore）固定五個面向與權重**：基本面動能 30%、估值吸引力 20%、技術面 15%、籌碼與衍生品 15%、消息與事件風險 20%；`score` = 加權平均（四捨五入）。`bullCase`／`bearCase` 各 ≥ 3 點、`verdict` 要寫出確認／否定訊號。

**最低深度要求**（低於此標準視為未完成）：`moatSources` ≥ 2、`segmentMix` 全部部門、`productLines` ≥ 3、`earningsCallTakeaways` ≥ 5、`financialMetrics.quarterly` ≥ 4 季實際值 + 1 季指引、`growthDrivers` ≥ 4、`secRisks` ≥ 5、`keyLevels` 五種類型各一、`relativeStrength.benchmarks` 含 SPY、QQQ、產業 ETF 與 ≥ 1 家同業、`recentNews` ≥ 6（含最近一次財報與所有近 3 個月 8-K 級事件）、`catalystTimeline` ≥ 6 且涵蓋未來 4 季、`meta.sources` ≥ 10。

寫完後：

```bash
npm run validate        # 必須全綠；有錯就修到通過為止
npm run sync:index      # 更新 data/index.json
```

### Step 4 — 雲端雙向推播

1. 若 `.env` 已設定 `VITE_GAS_API_URL`：執行 `npm run sync:push TICKER`，確認輸出顯示「新增／更新於第 N 列」與 Changelog_History 筆數。失敗時回報錯誤訊息，不要重試超過一次。
2. 執行 `npm run build` 確認網站可建置（零錯誤）。
3. 向使用者回報：評等與三情境（含與上一版的差異）、與華爾街共識的預期差、最重要的 3 個變化、仍待補的資料（`dataQualityNotes`）。
4. **詢問**使用者是否要 `git add data && git commit && git push`——未經同意不要 commit 或 push。commit message 範例：`data(MRVL): update after Q3 FY27 earnings, base 216 -> 240`。

---

## 其他規則

- `.env`（含 `GAS_SECRET_TOKEN`）絕對不可 commit、不可印在對話中、不可放進前端（不得加 `VITE_` 前綴）。
- 修改 Schema 時：同步更新所有 `data/stocks/*.json`、`src/` 對應顯示、`gas/Code.gs` 的必要欄位檢查，並提升 `schemaVersion` 小版號；跑 `npm run validate` 與 `npm run build`。
- 修改 `gas/Code.gs` 後要提醒使用者：在 Apps Script「管理部署作業 → 編輯 → 版本：新版本」重新部署，網址才會沿用。
- 網站改動要用瀏覽器預覽驗證（深色／淺色、375px 手機寬度不可出現水平捲動）。
