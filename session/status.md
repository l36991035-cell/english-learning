# Session Status

## 已知問題與解法

### localhost 無法開啟
- **現象：** `npm run dev` 啟動後，瀏覽器開啟 `http://localhost:3000` 顯示 "This page could not be found"
- **原因：** `next.config.ts` 設定了 `basePath: '/english-learning'`，根路徑 `/` 不存在
- **解法：** 正確網址是 `http://localhost:3000/english-learning`

### 本機翻譯失敗（翻譯失敗提示）
- **現象：** dev 環境按翻譯按鈕後顯示「翻譯失敗」
- **原因：** 本機沒有 `.env.local`，`callAI()` fallback 到 `/api/claude`，但本地 API route 缺少 `ANTHROPIC_API_KEY`
- **解法：** 建立 `.env.local`，設定 `NEXT_PUBLIC_AI_WORKER_URL=https://english-learning-api.l36991035.workers.dev`，讓本機直接呼叫已部署的 Cloudflare Worker；設定後需重啟 dev server

---

## 功能開發紀錄

### 2026-07-14 新增「中翻英」功能
- 新增獨立頁面 `/translate`（中翻英）
- 輸入中文 → AI 翻譯成自然英文 + 切出 Chunk 對應關係
- 每個 Chunk 可一鍵存入 Chunk 庫
- 同步更新：`types/index.ts` 的 source 欄位加入 `'translation'`
- Chunk 庫來源標籤加入「中翻英」顯示
