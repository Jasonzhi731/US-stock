# 美股深度分析終端 US Equity Research Terminal

以統一 JSON Schema 管理的美股深度分析網站：基本面與財測指引、技術與籌碼／衍生品訊號、消息與催化劑時間軸、三情境目標價與華爾街共識對照、歷史觀點演進，並提供互動式估值試算器。

- **資料**：`data/stocks/{TICKER}.json`，規格見 `schema/stock-analysis.schema.json`
- **雲端同步**：Google Sheets + Apps Script（`gas/Code.gs`），`=GOOGLEFINANCE()` 提供即時報價
- **網站**：Vite + React + Tailwind CSS + Lucide，先載本地 JSON 秒開，再於背景拉取即時資料
- **部署**：push 到 `main` → GitHub Actions 驗證資料 → GitHub Pages

```bash
npm install
npm run dev            # 開發
npm run validate       # 驗證所有分析檔
npm run build          # 驗證 + 建置
npm run sync:push MRVL # 推送到 Google Sheets
npm run sync:pull      # 從 Google Sheets 拉回
```

設定步驟見 [SETUP_GUIDE.md](SETUP_GUIDE.md)；AI 更新流程見 [CLAUDE.md](CLAUDE.md)。

> 本專案內容為 AI 輔助研究整理，僅供資訊參考，不構成投資建議。
