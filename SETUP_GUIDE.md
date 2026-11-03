# 設定指南：GitHub + Google Sheets 雙向同步

整體架構：

```
          ┌──────────── 電腦 A / 電腦 B（Claude Code）────────────┐
          │  data/stocks/*.json  ←→  scripts/sync.mjs (push/pull) │
          └───────────────┬───────────────────────┬──────────────┘
                git push / pull                POST (Token) / GET
                          │                       │
                 ┌────────▼────────┐     ┌────────▼──────────────────────┐
                 │ GitHub (/data)  │     │ Google Sheets + Apps Script    │
                 │ Actions → Pages │     │ US_Stocks_Index（GOOGLEFINANCE）│
                 └────────┬────────┘     │ Changelog_History              │
                          │              └────────┬──────────────────────┘
                          ▼                       │ GET ?action=list（公開）
                    網站（GitHub Pages） ◄─────────┘  即時報價、最新分析
```

- **GitHub `/data`**：所有分析 JSON 的版本控管與備份，push 到 `main` 自動部署網站。
- **Google Sheets**：跨電腦的雲端同步點，並用 `=GOOGLEFINANCE()` 提供即時報價、當日漲跌、市值與 52 週高低；網站在背景讀取並重算潛在漲跌幅。
- **免 GCP Service Account**：只需要一組 Web App 網址（公開）與一組 Token（只放在每台電腦的 `.env`）。

---

## 1. 前置需求

| 工具 | 版本 | 備註 |
|---|---|---|
| Node.js | 20.19 以上（建議 24 LTS） | Windows 可用官方可攜版 zip 解壓到 `%LOCALAPPDATA%\Programs\nodejs` 並加入使用者 PATH |
| Git | 任意新版 | |
| Google 帳號 | — | 用來建立 Sheet 與 Apps Script |
| GitHub 帳號 | — | 用來放 repo 與 Pages |

```bash
npm install
npm run dev
```

開啟 http://localhost:5173 ，未設定 `.env` 時網站會以本地 `/data` 秒開（右上角顯示「本地資料」）。

## 2. 建立 Google Sheet 與 Apps Script

1. 到 Google Sheets 建立一份新的空白試算表（例如命名「US Stocks Analysis」）。
2. 選單「**擴充功能 → Apps Script**」。
3. 刪除編輯器裡預設的 `function myFunction() {}`，把 `gas/Code.gs` **全部內容**貼上，按儲存。
4. （選用）左側「專案設定」勾選「在編輯器中顯示 appsscript.json」，用 `gas/appsscript.json` 取代，時區會設為 Asia/Taipei。
5. 上方函式下拉選單選 `setupSheet` → 執行。第一次會要求授權：選你的帳號 →「進階」→「前往（不安全）」→ 允許。
   - 完成後試算表會出現 `US_Stocks_Index`、`Changelog_History` 兩個工作表（另有隱藏的 `_JSON_Overflow` 存放超過單格 5 萬字元的 JSON 片段）。
   - 會跳出 **SECRET_TOKEN**；之後也可執行 `showSecretToken` 或用試算表選單「📈 美股分析 → 顯示 Secret Token」再看一次。

## 3. 部署為 Web App

1. Apps Script 右上角「**部署 → 新增部署作業**」。
2. 類型選「**網頁應用程式**」。
3. 說明隨意；「執行身分」選「**我**」；「誰可以存取」選「**任何人**」。
4. 按「部署」，複製結尾為 `/exec` 的網址。

> 之後若修改 `Code.gs`，請用「**管理部署作業 → 編輯（鉛筆）→ 版本：新版本 → 部署**」，網址會保持不變；若用「新增部署作業」會產生新網址，需要更新每台電腦的 `.env` 與 GitHub 變數。

## 4. 設定 `.env`

```bash
cp .env.example .env
```

```ini
VITE_GAS_API_URL=https://script.google.com/macros/s/XXXXXXXX/exec
GAS_SECRET_TOKEN=貼上 SECRET_TOKEN
```

- `VITE_GAS_API_URL` 會被打包進前端（公開資訊）。
- `GAS_SECRET_TOKEN` 只給 `sync.mjs` 寫入用，**不能**加 `VITE_` 前綴、不要 commit（`.gitignore` 已排除 `.env`）。

驗證：

```bash
npm run sync:ping          # 顯示「連線成功」「Token 驗證通過」
npm run sync:push          # 推送全部股票（或 npm run sync:push MRVL）
```

回到試算表，`US_Stocks_Index` 會出現 MRVL 一列，`Live_Price`、`Change_Pct`、`Market_Cap`、`High_52W`、`Low_52W` 由 GOOGLEFINANCE 自動帶出，`Live_Upside_Pct` 以 Base 目標價即時計算；`Changelog_History` 會寫入首次覆蓋紀錄。重新整理網站，右上角會變成「即時 · Google Sheets」。

## 5. 第二台電腦

```bash
git clone https://github.com/<你的帳號>/<repo>.git
cd <repo>
npm install
# 建立 .env（建議從密碼管理器取得同一組網址與 Token）
npm run sync:pull          # 拉回 Google Sheets 上所有最新分析
```

`sync:pull` 會比較 `updatedAt`：本地較新的檔案會保留並提示；確定要以雲端為準時用 `npm run sync:pull -- --force`。

## 6. 綁定 GitHub 與自動部署

1. 在 GitHub 建立新 repo（Public 才能使用免費 Pages；Private 需付費方案）。
2. 在專案資料夾：

   ```bash
   git init -b main
   git add .
   git commit -m "Initial commit: US stock analysis terminal"
   git remote add origin https://github.com/<你的帳號>/<repo>.git
   git push -u origin main
   ```

3. Repo → **Settings → Pages → Build and deployment → Source** 選「**GitHub Actions**」。
4. Repo → **Settings → Secrets and variables → Actions → Variables** 分頁 → New repository variable：
   `VITE_GAS_API_URL` = 你的 `/exec` 網址（不要放 Token）。
5. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 會：`npm ci` → `npm run build`（內含 Schema 驗證，資料不合規就不部署）→ 發布到 `https://<你的帳號>.github.io/<repo>/`。

## 7. 日常流程

在 Claude Code 中直接說「**新增美股 NVDA**」或「**更新美股 MRVL**」，Claude 會依 `CLAUDE.md` 的四步驟 SOP：同步 → 聯網研究 → 寫入 JSON 與 changelog → 推送 Sheets，最後詢問是否 commit／push。

## 8. 安全性說明

- `GET`（網站讀取）預設公開：知道 Web App 網址的人可以讀到分析與報價。若想關閉，在 Apps Script 執行 `setPublicRead(false)`（關閉後網站無法取得即時報價，`sync:pull` 仍可用 Token 拉取）。
- 所有寫入（`upsert`、`delete`、`export`）都需要 Token，Token 以 POST body 傳送，不會出現在網址。
- Token 外洩時執行 `rotateSecretToken`，並更新每台電腦的 `.env`。

## 9. 疑難排解

| 症狀 | 處理 |
|---|---|
| `sync` 顯示「收到 HTML 而非 JSON」 | Web App 的「誰可以存取」不是「任何人」，或網址不是最新部署的 `/exec` |
| `GAS 回應錯誤：unauthorized` | `.env` 的 Token 與 Script Properties 不一致；執行 `showSecretToken` 核對 |
| Live_Price 空白或 `#N/A` | GOOGLEFINANCE 暫時載入中或代號／交易所錯誤（只支援 `NASDAQ`、`NYSE`）；可用選單「重建即時報價公式」 |
| 網站一直顯示「雲端連線失敗」 | 確認 GitHub 變數 `VITE_GAS_API_URL` 有設定且重新部署；網站已內建 JSONP 備援 |
| 報價跟券商有落差 | GOOGLEFINANCE 約延遲 20 分鐘，盤後不更新 |
| `npm run build` 失敗於 validate | 依錯誤訊息修正 `data/stocks/*.json`；Schema 規則見 `schema/stock-analysis.schema.json` |
